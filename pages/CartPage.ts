import { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

/** Converts a price label such as "₫1,000,000" into the number 1000000. */
export const toNumber = (text: string): number => Number(text.replace(/[^\d]/g, ''));

/** Slide-out cart drawer (nav dropdown) and the /vn/cart page. */
export class CartPage extends BasePage {
  // ---- Slide-out drawer ----
  /**
   * The drawer is a Headless UI popover panel. It has no role="dialog" in this storefront,
   * so its data-testid is the most stable hook.
   */
  readonly cartDrawer: Locator;
  readonly drawerItems: Locator;
  readonly drawerSubtotal: Locator;
  readonly goToCartButton: Locator;

  // ---- /vn/cart page ----
  readonly pageHeading: Locator;
  readonly lineItems: Locator;
  readonly subtotal: Locator;
  readonly checkoutButton: Locator;

  constructor(page: Page) {
    super(page);
    this.cartDrawer = page.getByTestId('nav-cart-dropdown');
    this.drawerItems = this.cartDrawer.getByTestId('cart-item');
    this.drawerSubtotal = this.cartDrawer.getByTestId('cart-subtotal');
    this.goToCartButton = this.cartDrawer.getByRole('button', { name: /go to cart/i });

    this.pageHeading = page.getByRole('heading', { name: 'Cart', level: 1 });
    this.lineItems = page.getByTestId('product-row');
    this.subtotal = page.getByTestId('cart-subtotal').first();
    this.checkoutButton = page.getByRole('button', { name: /go to checkout/i });
  }

  /** A product inside the drawer. */
  drawerItem(productName: string): Locator {
    return this.drawerItems.filter({ hasText: new RegExp(productName, 'i') });
  }

  /** A line item row on /vn/cart — row-scoped locators stay strict-mode safe with many items. */
  lineItem(productName: string): Locator {
    return this.lineItems.filter({ hasText: new RegExp(productName, 'i') });
  }

  quantitySelect(productName: string): Locator {
    return this.lineItem(productName).getByTestId('product-select-button');
  }

  unitPrice(productName: string): Locator {
    return this.lineItem(productName).getByTestId('product-unit-price');
  }

  /** The trash icon is the only button inside a cart row. */
  removeButton(productName: string): Locator {
    return this.lineItem(productName).getByRole('button');
  }

  async open(): Promise<void> {
    await this.navigateTo('/vn/cart');
  }

  /** Clicks "Go to cart" inside the drawer (the drawer auto-closes after a few seconds). */
  async goToCartFromDrawer(): Promise<void> {
    await this.goToCartButton.click();
    await this.page.waitForURL(/\/cart/, { timeout: 20_000 });
  }

  /** Changes a line item's quantity and waits for the update Server Action to finish. */
  async setQuantity(productName: string, quantity: number): Promise<void> {
    await Promise.all([
      this.page.waitForResponse(
        (resp) => resp.request().method() === 'POST' && resp.url().includes('/cart'),
        { timeout: 60_000 },
      ),
      this.quantitySelect(productName).selectOption(String(quantity)),
    ]);
  }

  /** Removes a line item and waits for the delete Server Action to finish. */
  async removeItem(productName: string): Promise<void> {
    await Promise.all([
      this.page.waitForResponse(
        (resp) => resp.request().method() === 'POST' && resp.url().includes('/cart'),
        { timeout: 60_000 },
      ),
      this.removeButton(productName).click(),
    ]);
  }

  async readSubtotal(): Promise<number> {
    return toNumber(await this.subtotal.innerText());
  }

  async readUnitPrice(productName: string): Promise<number> {
    return toNumber(await this.unitPrice(productName).innerText());
  }

  async proceedToCheckout(): Promise<void> {
    await this.checkoutButton.click();
    await this.page.waitForURL(/\/checkout/, { timeout: 30_000 });
  }
}
