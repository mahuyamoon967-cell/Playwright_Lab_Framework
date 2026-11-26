import { Locator, Page, Response } from '@playwright/test';

/**
 * Shared behaviour for every page object.
 * Page objects hold locators and user actions only — assertions (expect) live in the tests.
 */
export abstract class BasePage {
  readonly page: Page;
  /** "Cart (n)" link in the top navigation bar. */
  readonly cartLink: Locator;
  /** "Menu" button that opens the side navigation. */
  readonly menuButton: Locator;
  /** "Store" link inside the side navigation. */
  readonly storeNavLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.cartLink = page.getByTestId('nav-cart-link');
    this.menuButton = page.getByRole('button', { name: /menu/i });
    this.storeNavLink = page.getByRole('link', { name: /^store$/i });
  }

  /** Opens the side menu and goes to the Store catalog. */
  async openStoreFromMenu(): Promise<void> {
    await this.menuButton.click({ timeout: 20_000 });
    await this.storeNavLink.click();
    await this.page.waitForURL(/\/store/, { timeout: 20_000 });
  }

  /**
   * Navigates to `path` (relative to baseURL).
   * The free-tier staging server returns a 504 while it wakes up from a cold start,
   * so the navigation is repeated (up to `attempts` times) while the server answers with a 5xx.
   */
  async navigateTo(path: string = '/', attempts: number = 4): Promise<Response | null> {
    let response: Response | null = null;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      response = await this.page.goto(path, { timeout: 45_000 });
      if (!response || response.status() < 500) break;
    }
    return response;
  }

  /** The cart badge when it shows exactly `count` items, e.g. "Cart (1)". */
  cartBadge(count: number): Locator {
    return this.page.getByRole('link', { name: new RegExp(`^cart\\s*\\(${count}\\)$`, 'i') });
  }
}
