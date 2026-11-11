import { v2 as cloudinary } from "cloudinary";
import { getRuntimeConfig } from "./runtimeConfig.js";

if (!getRuntimeConfig().cloudinary.url) {
  throw new Error("CLOUDINARY_URL is missing");
}

cloudinary.config({
  secure: true,
});

export { cloudinary };
