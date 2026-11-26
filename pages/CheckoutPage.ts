import { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { toNumber } from './CartPage';

export interface ShippingAddress {
  firstName: string;
  lastName: string;
  address: string;
  postalCode: string;
  city: string;
  email: string;
  phone?: string;
}

/** Guest checkout: address → delivery → payment → review → order confirmation. */
export class CheckoutPage extends BasePage {
  // ---- Step 1: shipping address ----
  readonly shippingAddressHeading: Locator;
  readonly firstNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly addressInput: Locator;
  readonly postalCodeInput: Locator;
  readonly cityInput: Locator;
  readonly countrySelect: Locator;
  readonly emailInput: Locator;
  readonly phoneInput: Locator;
  readonly continueToDeliveryButton: Locator;
  readonly shippingAddressSummary: Locator;

  // ---- Step 2: delivery ----
  readonly continueToPaymentButton: Locator;
  readonly deliverySummary: Locator;

  // ---- Step 3: payment ----
  readonly continueToReviewButton: Locator;
  readonly paymentMethodSummary: Locator;

  // ---- Step 4: review ----
  readonly placeOrderButton: Locator;

  // ---- Order summary panel ----
  readonly orderSummaryHeading: Locator;
  readonly orderSummaryItems: Locator;
  readonly subtotal: Locator;
  readonly shippingTotal: Locator;
  readonly total: Locator;

  // ---- Order confirmation page ----
  readonly orderConfirmation: Locator;
  readonly orderNumber: Locator;

  constructor(page: Page) {
    super(page);
    this.shippingAddressHeading = page.getByRole('heading', { name: /shipping address/i });
    this.firstNameInput = page.getByTestId('shipping-first-name-input');
    this.lastNameInput = page.getByTestId('shipping-last-name-input');
    this.addressInput = page.getByTestId('shipping-address-input');
    this.postalCodeInput = page.getByTestId('shipping-postal-code-input');
    this.cityInput = page.getByTestId('shipping-city-input');
    this.countrySelect = page.getByTestId('shipping-country-select');
    this.emailInput = page.getByTestId('shipping-email-input');
    this.phoneInput = page.getByTestId('shipping-phone-input');
    this.continueToDeliveryButton = page.getByRole('button', { name: /continue to delivery/i });
    this.shippingAddressSummary = page.getByTestId('shipping-address-summary');

    this.continueToPaymentButton = page.getByRole('button', { name: /continue to payment/i });
    this.deliverySummary = page.getByText(/standard shipping/i).first();

    this.continueToReviewButton = page.getByRole('button', { name: /continue to review/i });
    this.paymentMethodSummary = page.getByTestId('payment-method-summary');

    this.placeOrderButton = page.getByRole('button', { name: /place order/i });

    this.orderSummaryHeading = page.getByRole('heading', { name: /in your cart/i });
    this.orderSummaryItems = page.getByTestId('items-table').getByTestId('product-row');
    this.subtotal = page.getByTestId('cart-subtotal').first();
    this.shippingTotal = page.getByTestId('cart-shipping').first();
    this.total = page.getByTestId('cart-total').first();

    this.orderConfirmation = page.getByTestId('order-complete-container');
    this.orderNumber = page.getByTestId('order-id');
  }

  /** Delivery option radio, e.g. "Standard Shipping". */
  shippingMethod(name: string): Locator {
    return this.page.getByRole('radio', { name: new RegExp(name, 'i') });
  }

  /** Payment method radio, e.g. "Manual Payment". */
  paymentMethod(name: string): Locator {
    return this.page.getByRole('radio', { name: new RegExp(name, 'i') });
  }

  orderSummaryItem(productName: string): Locator {
    return this.orderSummaryItems.filter({ hasText: new RegExp(productName, 'i') });
  }

  async open(): Promise<void> {
    await this.navigateTo('/vn/checkout?step=address');
  }

  async fillShippingAddress(address: ShippingAddress): Promise<void> {
    await this.firstNameInput.fill(address.firstName);
    await this.lastNameInput.fill(address.lastName);
    await this.addressInput.fill(address.address);
    await this.postalCodeInput.fill(address.postalCode);
    await this.cityInput.fill(address.city);
    await this.emailInput.fill(address.email);
    if (address.phone) await this.phoneInput.fill(address.phone);
  }

  async continueToDelivery(): Promise<void> {
    await this.continueToDeliveryButton.click();
    await this.page.waitForURL(/step=delivery/, { timeout: 60_000 });
  }

  /** Choosing an option saves it to the cart; "Continue to payment" is enabled once that finishes. */
  async selectShippingMethod(name: string): Promise<void> {
    await this.shippingMethod(name).click({ timeout: 30_000 });
  }

  async continueToPayment(): Promise<void> {
    await this.continueToPaymentButton.click({ timeout: 30_000 });
    await this.page.waitForURL(/step=payment/, { timeout: 60_000 });
  }

  async selectPaymentMethod(name: string): Promise<void> {
    await this.paymentMethod(name).click({ timeout: 30_000 });
  }

  async continueToReview(): Promise<void> {
    await this.continueToReviewButton.click({ timeout: 30_000 });
    await this.page.waitForURL(/step=review/, { timeout: 60_000 });
  }

  /** Places the order and waits for the /order/<id>/confirmed page. */
  async placeOrder(): Promise<void> {
    await this.placeOrderButton.click();
    await this.page.waitForURL(/\/order\/[^/]+\/confirmed/, { timeout: 90_000 });
  }

  /** The order ID from the confirmation URL, e.g. "order_01J...". */
  orderIdFromUrl(): string {
    const match = this.page.url().match(/\/order\/([^/]+)\/confirmed/);
    return match ? match[1] : '';
  }

  async readSubtotal(): Promise<number> {
    return toNumber(await this.subtotal.innerText());
  }

  async readTotal(): Promise<number> {
    return toNumber(await this.total.innerText());
  }
}
