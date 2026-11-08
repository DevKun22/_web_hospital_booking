import { randomUUID } from "node:crypto";
import { UploadApiResponse } from "cloudinary";
import { Prisma } from "../../generated/prisma/client.js";
import type { MediaOwnerType } from "../../generated/prisma/enums.js";
import { cloudinary } from "../config/cloudinary.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/appError.js";
import { sniffMedicalFile } from "../utils/fileSignature.js";

type UploadFolder =
  | "departments"
  | "users"
  | "doctors"
  | "packages"
  | "medical-results"
  | "site-settings"
  | "banners";

const folderMap: Record<UploadFolder, string> = {
  departments: "hospital/departments",
  users: "hospital/users",
  doctors: "hospital/doctors",
  packages: "hospital/packages",
  "medical-results": "hospital/medical-results",
  "site-settings": "hospital/site-settings",
  banners: "hospital/banners",
};

const mediaAssetSelect = {
  id: true,
  url: true,
  publicId: true,
  folder: true,
  mimeType: true,
  format: true,
  bytes: true,
  width: true,
  height: true,
  ownerType: true,
  ownerId: true,
  isUsed: true,
  uploadedById: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.MediaAssetSelect;

const MEDICAL_FOLDER = folderMap["medical-results"];

// Tệp kết quả khám tải lên bằng endpoint riêng được lưu dạng `authenticated` (không có đường
// dẫn công khai, chỉ truy cập được qua URL có chữ ký do backend tạo). Tệp cũ (ảnh công khai)
// vẫn dùng bình thường.
const isAuthenticatedRawUrl = (url: string) => url.includes("/raw/authenticated/");

const destroyOptions = (asset: { url: string }) =>
  isAuthenticatedRawUrl(asset.url)
    ? { resource_type: "raw" as const, type: "authenticated" as const }
    : { resource_type: "image" as const };

const isUploadFolder = (folder: string): folder is UploadFolder =>
  Object.keys(folderMap).includes(folder);

const uploadBufferToCloudinary = (file: Express.Multer.File, folder: string) =>
  new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        transformation: [
          { width: 1600, height: 1600, crop: "limit" },
          { quality: "auto", fetch_format: "auto" },
        ],
      },
      (error, result) => {
        if (error || !result) {
          reject(error || new Error("Upload Cloudinary failed"));
          return;
        }

        resolve(result);
      },
    );

    stream.end(file.buffer);
  });

const uploadMedicalBufferToCloudinary = (buffer: Buffer, publicId: string) =>
  new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: MEDICAL_FOLDER,
        public_id: publicId,
        resource_type: "raw",
        type: "authenticated",
        overwrite: false,
      },
      (error, result) => {
        if (error || !result) {
          reject(error || new Error("Upload Cloudinary failed"));
          return;
        }
        resolve(result);
      },
    );
    stream.end(buffer);
  });

class MediaAssetService {
  async list(query: {
    isUsed?: boolean;
    folder?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(query.page || 1, 1);
    const limit = Math.min(Math.max(query.limit || 20, 1), 100);
    const skip = (page - 1) * limit;

    const where: Prisma.MediaAssetWhereInput = {
      isUsed: query.isUsed,
      folder: query.folder,
    };

    const [items, total] = await prisma.$transaction([
      prisma.mediaAsset.findMany({
        where,
        select: mediaAssetSelect,
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      }),
      prisma.mediaAsset.count({ where }),
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

  async uploadImages(
    files: Express.Multer.File[],
    folder: string,
    uploadedById?: string,
  ) {
    if (!files.length) {
      throw new AppError("Chưa chọn file upload", 400);
    }

    if (!isUploadFolder(folder)) {
      throw new AppError("Folder upload không hợp lệ", 400);
    }

    const cloudinaryFolder = folderMap[folder];

    const uploadedItems = await Promise.all(
      files.map(async (file) => {
        const result = await uploadBufferToCloudinary(file, cloudinaryFolder);

        return prisma.mediaAsset.create({
          data: {
            url: result.secure_url,
            publicId: result.public_id,
            folder: cloudinaryFolder,
            mimeType: file.mimetype,
            format: result.format,
            bytes: result.bytes,
            width: result.width,
            height: result.height,
            uploadedById,
          },
          select: mediaAssetSelect,
        });
      }),
    );

    return uploadedItems;
  }

  // Tệp kết quả khám (PDF hoặc ảnh): kiểm tra nội dung thật, lưu riêng tư, giữ nguyên không nén.
  async uploadMedicalFile(file: Express.Multer.File, uploadedById?: string) {
    const kind = sniffMedicalFile(file.buffer);
    if (!kind) {
      throw new AppError("Nội dung tệp không phải PDF, JPG, PNG hoặc WEBP", 400);
    }
    if (file.mimetype !== kind.mime) {
      throw new AppError("Loại tệp không khớp với nội dung", 400);
    }

    const result = await uploadMedicalBufferToCloudinary(
      file.buffer,
      `${randomUUID()}.${kind.extension}`,
    );

    return prisma.mediaAsset.create({
      data: {
        url: result.secure_url,
        publicId: result.public_id,
        folder: MEDICAL_FOLDER,
        mimeType: kind.mime,
        format: kind.extension,
        bytes: file.size,
        uploadedById,
      },
      select: mediaAssetSelect,
    });
  }

  // Gắn tệp kết quả vào hồ sơ khám khi bác sĩ lưu đường dẫn, để lệnh dọn ảnh không dùng
  // không bao giờ xóa tệp đang được dùng; nhả tệp cũ khi đường dẫn bị thay.
  async syncMedicalFile(input: {
    ownerId: string;
    url?: string | null;
    previousUrl?: string | null;
  }) {
    if (input.previousUrl && input.previousUrl !== input.url) {
      await this.detachOwnerAssetByUrl("MEDICAL_RESULT", input.ownerId, input.previousUrl);
    }
    if (!input.url) return null;

    const asset = await prisma.mediaAsset.findFirst({
      where: { url: input.url, folder: MEDICAL_FOLDER },
      select: mediaAssetSelect,
    });
    if (!asset) return null; // đường dẫn ngoài kho của hệ thống (tệp cũ hoặc nhập tay)
    return this.attachAsset(asset.id, "MEDICAL_RESULT", input.ownerId);
  }

  async attachAsset(
    assetId: string,
    ownerType: MediaOwnerType,
    ownerId: string,
  ) {
    const asset = await prisma.mediaAsset.findUnique({
      where: {
        id: assetId,
      },
      select: mediaAssetSelect,
    });

    if (!asset) {
      throw new AppError("Không tìm thấy ảnh đã upload", 404);
    }

    if (
      asset.isUsed &&
      (asset.ownerType !== ownerType || asset.ownerId !== ownerId)
    ) {
      throw new AppError("Ảnh này đã được sử dụng", 409);
    }

    return prisma.mediaAsset.update({
      where: {
        id: assetId,
      },
      data: {
        isUsed: true,
        ownerType,
        ownerId,
      },
      select: mediaAssetSelect,
    });
  }

  async getUsableAsset(assetId: string) {
    const asset = await prisma.mediaAsset.findUnique({
      where: {
        id: assetId,
      },
      select: mediaAssetSelect,
    });

    if (!asset) {
      throw new AppError("Không tìm thấy ảnh đã upload", 404);
    }

    if (asset.isUsed) {
      throw new AppError("Ảnh này đã được sử dụng", 409);
    }

    return asset;
  }

  async detachOwnerAssets(
    ownerType: MediaOwnerType,
    ownerId: string,
    exceptAssetId?: string | string[],
  ) {
    const exceptAssetIds = Array.isArray(exceptAssetId)
      ? exceptAssetId.filter(Boolean)
      : exceptAssetId
        ? [exceptAssetId]
        : [];

    return prisma.mediaAsset.updateMany({
      where: {
        ownerType,
        ownerId,
        ...(exceptAssetIds.length ? { id: { notIn: exceptAssetIds } } : {}),
      },
      data: {
        isUsed: false,
        ownerType: null,
        ownerId: null,
      },
    });
  }

  async detachOwnerAssetByUrl(
    ownerType: MediaOwnerType,
    ownerId: string,
    url?: string | null,
  ) {
    if (!url) return { count: 0 };

    return prisma.mediaAsset.updateMany({
      where: {
        ownerType,
        ownerId,
        url,
      },
      data: {
        isUsed: false,
        ownerType: null,
        ownerId: null,
      },
    });
  }

  async deleteUnused(id: string) {
    const asset = await prisma.mediaAsset.findUnique({
      where: { id },
      select: mediaAssetSelect,
    });

    if (!asset) {
      throw new AppError("Không tìm thấy ảnh", 404);
    }

    if (asset.isUsed) {
      throw new AppError("Không thể xóa ảnh đang được sử dụng", 409);
    }

    await cloudinary.uploader.destroy(asset.publicId, destroyOptions(asset));

    await prisma.mediaAsset.delete({
      where: { id },
    });

    return asset;
  }

  async cleanupUnused(input: { olderThanHours?: number; limit?: number }) {
    const olderThanHours = Math.max(input.olderThanHours || 24, 1);
    const limit = Math.min(Math.max(input.limit || 50, 1), 100);
    const olderThan = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);

    const candidates = await prisma.mediaAsset.findMany({
      where: {
        isUsed: false,
        // Tệp kết quả khám là dữ liệu y tế: không tự động xóa hàng loạt.
        folder: { not: MEDICAL_FOLDER },
        createdAt: {
          lt: olderThan,
        },
      },
      select: mediaAssetSelect,
      orderBy: {
        createdAt: "asc",
      },
      take: limit,
    });

    const deleted: typeof candidates = [];
    const failed: { id: string; publicId: string; message: string }[] = [];

    for (const asset of candidates) {
      try {
        await cloudinary.uploader.destroy(asset.publicId, destroyOptions(asset));

        await prisma.mediaAsset.delete({
          where: { id: asset.id },
        });

        deleted.push(asset);
      } catch (error) {
        failed.push({
          id: asset.id,
          publicId: asset.publicId,
          message: error instanceof Error ? error.message : "Xóa ảnh thất bại",
        });
      }
    }

    return {
      olderThan,
      scanned: candidates.length,
      deletedCount: deleted.length,
      failedCount: failed.length,
      deleted,
      failed,
    };
  }
}

export default new MediaAssetService();
