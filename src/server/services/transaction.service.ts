import { transactionRepository } from "@/server/repositories/transaction.repository";

export const transactionServerService = {
  getAll: () => transactionRepository.findMany(),
};
