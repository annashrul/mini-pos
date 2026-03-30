export interface MutationResult<TData = unknown> {
  success?: boolean;
  error?: string;
  data?: TData;
}

export async function runMutation<TData>(
  mutation: () => Promise<MutationResult<TData>>
): Promise<MutationResult<TData>> {
  try {
    return await mutation();
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message };
    }
    return { error: "Terjadi kesalahan saat memproses permintaan" };
  }
}
