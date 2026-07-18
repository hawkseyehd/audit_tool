import { createServer, type Server } from "node:http";

export interface AuditFixtureSite {
  readonly url: string;
  close(): Promise<void>;
  getRequests(): readonly { readonly method: string; readonly path: string }[];
}

export async function startAuditFixtureSite(): Promise<AuditFixtureSite> {
  const requests: { method: string; path: string }[] = [];
  const server = createServer((request, response) => {
    requests.push({ method: request.method ?? "UNKNOWN", path: request.url ?? "/" });
    if (request.url === "/robots.txt") {
      response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      response.end("User-agent: *\nAllow: /\nSitemap: /sitemap.xml");
      return;
    }
    if (request.url === "/sitemap.xml") {
      response.writeHead(200, { "content-type": "application/xml; charset=utf-8" });
      response.end("<?xml version='1.0'?><urlset></urlset>");
      return;
    }

    const isContact = request.url === "/contact";
    response.writeHead(200, {
      "content-security-policy": "default-src 'self'",
      "content-type": "text/html; charset=utf-8",
      "referrer-policy": "strict-origin-when-cross-origin",
      "set-cookie": "fixture-session=private-fixture-value; Secure; HttpOnly; SameSite=Lax",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
    });
    response.end(isContact ? contactPage() : homePage());
  });

  await listen(server);
  const address = server.address();
  if (address === null || typeof address === "string") {
    await close(server);
    throw new Error("Fixture server did not expose a TCP port");
  }

  return {
    url: `http://127.0.0.1:${String(address.port)}/`,
    close: () => close(server),
    getRequests: () => [...requests],
  };
}

function homePage(): string {
  return "<!doctype html><html lang='en'><head><title>Controlled Website Audit Fixture</title><meta name='description' content='A controlled local website used for repeatable browser, accessibility, scanner, and report integration testing.'><link rel='canonical' href='/'></head><body><header><nav><a href='/contact'>Contact</a><a href='/pricing'>Pricing</a><a href='/services'>Services</a><a href='/product'>Product</a><a href='/about'>About</a><a href='/blog'>Blog</a><a href='/booking'>Booking</a><a href='/checkout'>Checkout</a><a href='/login'>Login</a></nav></header><main><h1>Audit fixture</h1><p>Reliable local integration evidence.</p><button></button><a href='/contact'>Contact us</a></main></body></html>";
}

function contactPage(): string {
  return "<!doctype html><html lang='en'><head><title>Contact the Audit Fixture Team</title><meta name='description' content='Contact form fixture with deliberate quality defects for deterministic scanner integration coverage.'><link rel='canonical' href='/contact'></head><body><header><nav><a href='/'>Home</a></nav></header><main><h1>Contact</h1><form><input name='email' type='email' placeholder='Email' required><button type='submit'>Submit</button></form></main></body></html>";
}

function listen(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error === undefined) resolve();
      else reject(error);
    });
  });
}
