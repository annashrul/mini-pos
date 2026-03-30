import { productRepository } from "@/server/repositories/product.repository";

export const productServerService = {
  getAll: () => productRepository.findMany(),
};
