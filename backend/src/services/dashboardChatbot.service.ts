import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/appError.js";

type DateRange = {
  from?: Date;
  to?: Date;
};

const logSelect = {
  id: true,
  sessionId: true,
  guestPhone: true,
  message: true,
  response: true,
  intent: true,
  sourceIds: true,
  createdAt: true,
  user: {
    select: {
      id: true,
      fullName: true,
      phone: true,
      role: true,
    },
  },
} satisfies Prisma.ChatbotLogSelect;

const sessionListSelect = {
  id: true,
  userId: true,
  guestPhone: true,
  draft: true,
  currentIntent: true,
  currentState: true,
  lastActions: true,
  lastMessage: true,
  lastResponse: true,
  isActive: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      fullName: true,
      phone: true,
      role: true,
    },
  },
  _count: {
    select: {
      logs: true,
    },
  },
} satisfies Prisma.ChatbotSessionSelect;

const sessionDetailSelect = {
  ...sessionListSelect,
  logs: {
    select: logSelect,
    orderBy: {
      createdAt: "asc",
    },
  },
} satisfies Prisma.ChatbotSessionSelect;

const getPagination = (page?: number, limit?: number) => {
  const safePage = Math.max(page || 1, 1);
  const safeLimit = Math.min(Math.max(limit || 20, 1), 100);

  return {
    page: safePage,
    limit: safeLimit,
    skip: (safePage - 1) * safeLimit,
  };
};

const buildCreatedAtRange = (range: DateRange) => {
  if (!range.from && !range.to) return undefined;

  return {
    gte: range.from,
    lte: range.to,
  };
};

class DashboardChatbotService {
  async listLogs(query: {
    search?: string;
    sessionId?: string;
    guestPhone?: string;
    intent?: string;
    dateFrom?: Date;
    dateTo?: Date;
    page?: number;
    limit?: number;
  }) {
    const { page, limit, skip } = getPagination(query.page, query.limit);

    const where: Prisma.ChatbotLogWhereInput = {
      sessionId: query.sessionId,
      guestPhone: query.guestPhone,
      intent: query.intent,
      createdAt: buildCreatedAtRange({
        from: query.dateFrom,
        to: query.dateTo,
      }),
    };

    if (query.search) {
      where.OR = [
        { message: { contains: query.search, mode: "insensitive" } },
        { response: { contains: query.search, mode: "insensitive" } },
        { guestPhone: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await prisma.$transaction([
      prisma.chatbotLog.findMany({
        where,
        select: logSelect,
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      }),
      prisma.chatbotLog.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async listSessions(query: {
    search?: string;
    guestPhone?: string;
    intent?: string;
    state?: string;
    isActive?: boolean;
    dateFrom?: Date;
    dateTo?: Date;
    page?: number;
    limit?: number;
  }) {
    const { page, limit, skip } = getPagination(query.page, query.limit);

    const where: Prisma.ChatbotSessionWhereInput = {
      guestPhone: query.guestPhone,
      currentIntent: query.intent,
      currentState: query.state,
      isActive: query.isActive,
      createdAt: buildCreatedAtRange({
        from: query.dateFrom,
        to: query.dateTo,
      }),
    };

    if (query.search) {
      where.OR = [
        { guestPhone: { contains: query.search, mode: "insensitive" } },
        { lastMessage: { contains: query.search, mode: "insensitive" } },
        { lastResponse: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await prisma.$transaction([
      prisma.chatbotSession.findMany({
        where,
        select: sessionListSelect,
        orderBy: {
          updatedAt: "desc",
        },
        skip,
        take: limit,
      }),
      prisma.chatbotSession.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getSessionById(id: string) {
    const session = await prisma.chatbotSession.findUnique({
      where: { id },
      select: sessionDetailSelect,
    });

    if (!session) {
      throw new AppError("Không tìm thấy phiên chatbot", 404);
    }

    return session;
  }

  async getOverview(range: DateRange) {
    const createdAt = buildCreatedAtRange(range);

    const [
      totalSessions,
      activeSessions,
      totalLogs,
      intentGroups,
      stateGroups,
      latestSessions,
    ] = await prisma.$transaction([
      prisma.chatbotSession.count({ where: { createdAt } }),
      prisma.chatbotSession.count({ where: { createdAt, isActive: true } }),
      prisma.chatbotLog.count({ where: { createdAt } }),
      prisma.chatbotLog.groupBy({
        by: ["intent"],
        where: { createdAt, intent: { not: null } },
        _count: { intent: true },
        orderBy: { _count: { intent: "desc" } },
        take: 8,
      }),
      prisma.chatbotSession.groupBy({
        by: ["currentState"],
        where: { createdAt, currentState: { not: null } },
        _count: { currentState: true },
        orderBy: { _count: { currentState: "desc" } },
        take: 8,
      }),
      prisma.chatbotSession.findMany({
        where: { createdAt },
        select: sessionListSelect,
        orderBy: { updatedAt: "desc" },
        take: 5,
      }),
    ]);

    return {
      metrics: {
        totalSessions,
        activeSessions,
        totalLogs,
      },
      intents: intentGroups.map((group) => ({
        intent: group.intent,
        count: group._count.intent,
      })),
      states: stateGroups.map((group) => ({
        state: group.currentState,
        count: group._count.currentState,
      })),
      latestSessions,
    };
  }
}

export default new DashboardChatbotService();
