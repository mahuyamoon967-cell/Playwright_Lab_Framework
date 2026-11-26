import { Locator, Page, Request } from '@playwright/test';
import { BasePage } from './BasePage';

export class ProductPage extends BasePage {
  readonly productContainer: Locator;
  readonly productTitle: Locator;
  readonly priceTag: Locator;
  readonly addToCartButton: Locator;

  /** In-flight React Server Component requests (the storefront syncs ?v_id=<variant> into the URL). */
  private readonly pendingRscRequests = new Set<Request>();
  /** Variant ID of the most recent URL-sync request, i.e. the variant the UI is switching to. */
  private lastRequestedVariantId: string | null = null;

  constructor(page: Page) {
    super(page);
    const isRsc = (request: Request) => request.url().includes('_rsc=');
    page.on('request', (request) => {
      if (!isRsc(request)) return;
      this.pendingRscRequests.add(request);
      const variantId = new URL(request.url()).searchParams.get('v_id');
      if (variantId) this.lastRequestedVariantId = variantId;
    });
    page.on('requestfinished', (request) => this.pendingRscRequests.delete(request));
    page.on('requestfailed', (request) => this.pendingRscRequests.delete(request));
    this.productContainer = page.getByTestId('product-container');
    this.productTitle = this.productContainer.getByRole('heading', { level: 2 });
    this.priceTag = page.getByTestId('product-price');
    this.addToCartButton = page.getByRole('button', { name: /add to cart/i });
  }

  /** Product card link on the /vn/store catalog. */
  storeProductLink(productName: string): Locator {
    return this.page.getByRole('link', { name: new RegExp(productName, 'i') }).first();
  }

  /** Size option button, e.g. "M". */
  sizeOption(size: string): Locator {
    return this.page.getByRole('button', { name: size, exact: true });
  }

  /** Color option button, e.g. "White". */
  colorOption(color: string): Locator {
    return this.page.getByRole('button', { name: color, exact: true });
  }

  /** Opens the catalog and clicks into the product detail page. */
  async openProductFromStore(productName: string): Promise<void> {
    await this.navigateTo('/vn/store');
    await this.clickProductInStore(productName);
  }

  /** Clicks a product card on the catalog page that is already open. */
  async clickProductInStore(productName: string): Promise<void> {
    await this.storeProductLink(productName).click({ timeout: 20_000 });
    await this.page.waitForURL(/\/products\//, { timeout: 20_000 });
  }

  /** Option buttons render disabled until product data loads; click() waits until they are enabled. */
  async selectSize(size: string): Promise<void> {
    await this.selectOption(this.sizeOption(size));
  }

  async selectColor(color: string): Promise<void> {
    await this.selectOption(this.colorOption(color));
  }

  /**
   * Clicks an option and waits for the URL-sync (RSC) request it triggers, if any.
   * The request starts a few milliseconds after the click, so it is awaited as an event
   * (max 5s when the click does not trigger one) instead of with a fixed sleep.
   */
  private async selectOption(option: Locator): Promise<void> {
    const urlSync = this.page
      .waitForRequest((request) => request.url().includes('_rsc='), { timeout: 5_000 })
      .catch(() => null);
    await option.click({ timeout: 20_000 });
    const request = await urlSync;
    if (request) await request.response().catch(() => null);
  }

  /**
   * Selecting an option makes the storefront update the URL (?v_id=...) with a background RSC request.
   * If "Add to cart" is clicked while that is still in flight, the storefront silently drops the add,
   * so wait until every pending variant/URL update has finished.
   */
  async waitForVariantSelectionToSettle(): Promise<void> {
    while (this.pendingRscRequests.size > 0) {
      await Promise.all([...this.pendingRscRequests].map((request) => request.response().catch(() => null)));
      this.pendingRscRequests.clear();
    }
    // The router has finished switching once the address bar shows the last requested variant.
    const variantId = this.lastRequestedVariantId;
    if (variantId) {
      await this.page.waitForURL((url) => url.searchParams.get('v_id') === variantId, { timeout: 30_000 });
    }
  }

  /**
   * Clicks "Add to cart" once and waits for the add-to-cart Server Action (POST) to finish.
   * Waiting for the response — instead of clicking a second time — avoids adding the item twice
   * when the backend is slow.
   */
  async addToCart(): Promise<void> {
    await this.waitForVariantSelectionToSettle();
    await Promise.all([
      this.page.waitForResponse(
        (resp) => resp.request().method() === 'POST' && resp.url().includes('/products/'),
        { timeout: 60_000 },
      ),
      this.addToCartButton.click({ timeout: 20_000 }),
    ]);
  }
}
