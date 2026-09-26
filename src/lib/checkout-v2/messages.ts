import type { CheckoutV2ErrorCode } from "./errors";

const UZ: Partial<Record<CheckoutV2ErrorCode, string>> = {
  UNAUTHENTICATED: "Avval tizimga kiring.",
  FORBIDDEN_ROLE: "Kursni faqat o‘quvchi hisobi sotib oladi.",
  PURCHASE_NOT_ALLOWED: "Bu hisob uchun xarid o‘chirilgan. Qo‘llab-quvvatlashga yozing.",
  ACCOUNT_BLOCKED: "Hisob bloklangan. Qo‘llab-quvvatlashga yozing.",
  ACCOUNT_RESTRICTED: "Hisob cheklangan. Qo‘llab-quvvatlashga yozing.",
  FEATURE_DISABLED: "Kurs xaridi hozircha yopiq.",
  COURSE_NOT_FOUND: "Kurs topilmadi.",
  IDEMPOTENCY_CONFLICT: "So‘rov takrorlandi. Sahifani yangilab qayta urinib ko‘ring.",
  IDEMPOTENCY_KEY_REQUIRED: "So‘rov noto‘g‘ri. Sahifani yangilang.",
  ALREADY_ENROLLED: "Siz bu kursga allaqachon yozilgansiz.",
  CAPACITY_FULL: "Joylar tugagan.",
  COURSE_NOT_PURCHASABLE: "Bu kurs hozir sotuvda emas.",
  PRICE_UNAVAILABLE: "Kurs narxi hali belgilanmagan.",
  INVALID_BODY: "So‘rov noto‘g‘ri. Sahifani yangilang.",
  PROVIDER_NOT_IMPLEMENTED: "Bu to‘lov usuli hali ishlamaydi.",
  INTERNAL_ERROR: "Xatolik yuz berdi. Keyinroq urinib ko‘ring.",
};

export function checkoutErrorMessageUz(code: string | undefined): string {
  return (code && UZ[code as CheckoutV2ErrorCode]) || "To‘lov amalga oshmadi.";
}
