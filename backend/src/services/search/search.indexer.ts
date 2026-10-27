import {
  elasticClient,
  elasticsearchIndex,
  isElasticsearchEnabled,
} from "../../config/elasticsearch.js";
import { prisma } from "../../config/prisma.js";
import type { SearchDocument } from "./search.types.js";
import { resolveSupportSearchUrl } from "./search.urls.js";

const documentId = (type: SearchDocument["type"], id: string) =>
  `${type}:${id}`;

const toIso = (value?: Date | string | null) =>
  value ? new Date(value).toISOString() : undefined;

const logIndexError = (action: string, error: unknown) => {
  console.warn(`[ELASTICSEARCH] ${action} failed`, error);
};

class SearchIndexer {
  isEnabled() {
    return isElasticsearchEnabled && Boolean(elasticClient);
  }

  async ensureIndex() {
    if (!elasticClient || !this.isEnabled()) return false;

    const exists = await elasticClient.indices.exists({
      index: elasticsearchIndex,
    });

    if (exists) return true;

    await elasticClient.indices.create({
      index: elasticsearchIndex,
      settings: {
        analysis: {
          analyzer: {
            hospital_text: {
              type: "custom",
              tokenizer: "standard",
              filter: ["lowercase", "asciifolding"],
            },
          },
        },
      },
      mappings: {
        properties: {
          id: { type: "keyword" },
          type: { type: "keyword" },
          title: {
            type: "text",
            analyzer: "hospital_text",
            fields: { keyword: { type: "keyword" } },
          },
          description: { type: "text", analyzer: "hospital_text" },
          keywords: { type: "text", analyzer: "hospital_text" },
          url: { type: "keyword" },
          image: { type: "keyword" },
          isActive: { type: "boolean" },
          departmentId: { type: "keyword" },
          departmentName: { type: "text", analyzer: "hospital_text" },
          departmentSlug: { type: "keyword" },
          price: { type: "double" },
          priority: { type: "integer" },
          updatedAt: { type: "date" },
        },
      },
    });

    return true;
  }

  async upsert(document: SearchDocument) {
    if (!elasticClient || !this.isEnabled()) return;

    try {
      await this.ensureIndex();
      await elasticClient.index({
        index: elasticsearchIndex,
        id: documentId(document.type, document.id),
        document,
        refresh: false,
      });
    } catch (error) {
      logIndexError(`upsert ${document.type}:${document.id}`, error);
    }
  }

  async remove(type: SearchDocument["type"], id: string) {
    if (!elasticClient || !this.isEnabled()) return;

    try {
      await elasticClient.delete({
        index: elasticsearchIndex,
        id: documentId(type, id),
        refresh: false,
      });
    } catch (error: any) {
      if (error?.meta?.statusCode !== 404) {
        logIndexError(`delete ${type}:${id}`, error);
      }
    }
  }

  async syncDepartment(id: string) {
    const department = await prisma.department.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        image: true,
        symptomKeywords: true,
        triageDescription: true,
        isActive: true,
        updatedAt: true,
      },
    });

    if (!department) {
      await this.remove("department", id);
      return;
    }

    await this.upsert({
      id: department.id,
      type: "department",
      title: department.name,
      description: department.triageDescription || department.description,
      url: department.slug ? `/departments/${department.slug}` : "/departments",
      image: department.image,
      keywords: [
        department.name,
        department.slug || "",
        ...department.symptomKeywords,
      ].filter(Boolean),
      isActive: department.isActive,
      priority: 30,
      updatedAt: toIso(department.updatedAt),
    });
  }

  async syncDoctor(id: string) {
    const doctor = await prisma.doctorProfile.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        title: true,
        bio: true,
        specialization: true,
        consultationFee: true,
        isAvailable: true,
        updatedAt: true,
        user: {
          select: {
            fullName: true,
            avatar: true,
            isActive: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
            slug: true,
            isActive: true,
          },
        },
      },
    });

    if (!doctor) {
      await this.remove("doctor", id);
      return;
    }

    const title = [doctor.title, doctor.user.fullName]
      .filter(Boolean)
      .join(" ");

    await this.upsert({
      id: doctor.id,
      type: "doctor",
      title,
      description: doctor.bio || doctor.specialization,
      url: `/bac-si/${doctor.slug}`,
      image: doctor.user.avatar,
      keywords: [
        title,
        doctor.specialization || "",
        doctor.department.name,
        doctor.department.slug || "",
      ].filter(Boolean),
      isActive:
        doctor.isAvailable &&
        doctor.user.isActive &&
        doctor.department.isActive,
      departmentId: doctor.department.id,
      departmentName: doctor.department.name,
      departmentSlug: doctor.department.slug,
      price: doctor.consultationFee,
      priority: 25,
      updatedAt: toIso(doctor.updatedAt),
    });
  }

  async syncPackage(id: string) {
    const packageItem = await prisma.package.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        summary: true,
        basePrice: true,
        serviceFee: true,
        isActive: true,
        isPopular: true,
        updatedAt: true,
        department: {
          select: {
            id: true,
            name: true,
            slug: true,
            isActive: true,
          },
        },
        items: {
          select: {
            name: true,
            description: true,
            price: true,
            included: true,
          },
        },
      },
    });

    if (!packageItem) {
      await this.remove("package", id);
      return;
    }

    const includedItemsTotal = packageItem.items
      .filter((item) => item.included)
      .reduce((total, item) => total + item.price, 0);
    const finalPrice =
      (includedItemsTotal || packageItem.basePrice) + packageItem.serviceFee;

    await this.upsert({
      id: packageItem.id,
      type: "package",
      title: packageItem.name,
      description: packageItem.summary || packageItem.description,
      url: packageItem.slug ? `/packages/${packageItem.slug}` : "/packages",
      keywords: [
        packageItem.name,
        packageItem.slug || "",
        packageItem.summary || "",
        packageItem.description || "",
        packageItem.department?.name || "",
        ...packageItem.items.flatMap((item) => [
          item.name,
          item.description || "",
        ]),
      ].filter(Boolean),
      isActive:
        packageItem.isActive && (packageItem.department?.isActive ?? true),
      departmentId: packageItem.department?.id,
      departmentName: packageItem.department?.name,
      departmentSlug: packageItem.department?.slug,
      price: finalPrice,
      priority: packageItem.isPopular ? 35 : 20,
      updatedAt: toIso(packageItem.updatedAt),
    });
  }

  async syncPublicFAQ(id: string) {
    const faq = await prisma.publicFAQ.findUnique({
      where: { id },
      select: {
        id: true,
        question: true,
        answer: true,
        category: true,
        isActive: true,
        order: true,
        updatedAt: true,
      },
    });

    if (!faq) {
      await this.remove("faq", id);
      return;
    }

    await this.upsert({
      id: faq.id,
      type: "faq",
      title: faq.question,
      description: faq.answer,
      url: faq.category
        ? `/faqs?category=${encodeURIComponent(faq.category)}`
        : resolveSupportSearchUrl({
            title: faq.question,
            description: faq.answer,
            fallback: "/faqs",
          }),
      keywords: [faq.question, faq.answer, faq.category || ""].filter(Boolean),
      isActive: faq.isActive,
      priority: Math.max(5, 20 - faq.order),
      updatedAt: toIso(faq.updatedAt),
    });
  }

  async syncChatbotFAQ(id: string) {
    const faq = await prisma.chatbotFAQ.findUnique({
      where: { id },
      select: {
        id: true,
        question: true,
        answer: true,
        keywords: true,
        isActive: true,
        updatedAt: true,
      },
    });

    if (!faq) {
      await this.remove("chatbot_faq", id);
      return;
    }

    await this.upsert({
      id: faq.id,
      type: "chatbot_faq",
      title: faq.question,
      description: faq.answer,
      url: resolveSupportSearchUrl({
        title: faq.question,
        description: faq.answer,
        keywords: faq.keywords,
      }),
      keywords: [faq.question, faq.answer, ...faq.keywords].filter(Boolean),
      isActive: faq.isActive,
      priority: 15,
      updatedAt: toIso(faq.updatedAt),
    });
  }

  async reindexAll() {
    if (!this.isEnabled()) {
      console.warn(
        "[ELASTICSEARCH] Disabled. Set ELASTICSEARCH_ENABLED=true, ELASTICSEARCH_NODE and ELASTICSEARCH_API_KEY.",
      );
      return {
        enabled: false,
        indexed: 0,
      };
    }

    await this.ensureIndex();

    const [departments, doctors, packages, publicFAQs, chatbotFAQs] =
      await Promise.all([
        prisma.department.findMany({ select: { id: true } }),
        prisma.doctorProfile.findMany({ select: { id: true } }),
        prisma.package.findMany({ select: { id: true } }),
        prisma.publicFAQ.findMany({ select: { id: true } }),
        prisma.chatbotFAQ.findMany({ select: { id: true } }),
      ]);

    for (const item of departments) await this.syncDepartment(item.id);
    for (const item of doctors) await this.syncDoctor(item.id);
    for (const item of packages) await this.syncPackage(item.id);
    for (const item of publicFAQs) await this.syncPublicFAQ(item.id);
    for (const item of chatbotFAQs) await this.syncChatbotFAQ(item.id);

    return {
      enabled: true,
      indexed:
        departments.length +
        doctors.length +
        packages.length +
        publicFAQs.length +
        chatbotFAQs.length,
      counts: {
        departments: departments.length,
        doctors: doctors.length,
        packages: packages.length,
        publicFAQs: publicFAQs.length,
        chatbotFAQs: chatbotFAQs.length,
      },
    };
  }
}

export default new SearchIndexer();
