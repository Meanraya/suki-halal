export const ADULT_PRICE = 289;
export const CHILD_PRICE = 145;

export function calcTotal(adultCount, childCount) {
  return (Number(adultCount) || 0) * ADULT_PRICE + (Number(childCount) || 0) * CHILD_PRICE;
}
