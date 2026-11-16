// Order number shown to the customer everywhere: AM-000017 (AM- plus the database id padded to 6 digits).
export const formatOrderId = (id: string | number | null | undefined): string => {
  const digits = String(id ?? '').replace(/\D/g, '');
  return 'AM-' + (digits || '0').padStart(6, '0');
};