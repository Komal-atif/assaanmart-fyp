export const formatOrderId = (id: string | number | null | undefined): string => {
  const digits = String(id ?? '').replace(/\D/g, '');
  return 'AM-' + (digits || '0').padStart(6, '0');
};