export * from "@/server/actions/expenses";
import * as featureActions from "@/server/actions/expenses";

export const expensesService = {
  ...featureActions,
};
