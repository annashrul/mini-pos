export * from "@/server/actions/products";
import * as productActions from "@/server/actions/products";

export const productsService = {
  ...productActions,
};
