import { userRepository } from "@/server/repositories/user.repository";

export const userServerService = {
  getAll: () => userRepository.findMany(),
};
