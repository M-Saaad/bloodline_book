const SHOP_URL = "https://bloodlinebook.bigcartel.com";

const products = [
  {
    title: "Mensur Portrait A3",
    price: "20,00 €",
    description: "A3 portrait print from the Bloodline series.",
  },
  {
    title: "Mensur Portrait A3 (Edition)",
    price: "30,00 €",
    description: "Premium A3 edition with enhanced presentation.",
  },
];

export default function HomePage() {
  return (
    <main className="page">
      <header className="site-header">
        <div className="brand">Bloodline Book</div>
        <a className="nav-link" href={SHOP_URL} target="_blank" rel="noreferrer">
          Shop
        </a>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <h1>Portraits drawn from memory, lineage, and myth.</h1>
          <p>
            Bloodline Book is a visual project exploring identity through
            portraiture. Browse available prints and editions, or visit the
            shop to purchase.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href={SHOP_URL} target="_blank" rel="noreferrer">
              Visit Shop
            </a>
            <a className="button button-secondary" href="#prints">
              View Prints
            </a>
          </div>
        </div>

        <div className="art-frame" aria-hidden="true">
          <div className="art-label">
            <span>Featured Work</span>
            <strong>Mensur Portrait</strong>
          </div>
        </div>
      </section>

      <section className="section" id="prints">
        <div className="section-heading">
          <h2>Available Prints</h2>
          <p>
            Current releases from the Bloodline collection. Purchases are
            handled securely through the online shop.
          </p>
        </div>

        <div className="product-grid">
          {products.map((product) => (
            <article className="product-card" key={product.title}>
              <h3>{product.title}</h3>
              <p>{product.description}</p>
              <div className="product-meta">
                <span className="price">{product.price}</span>
                <a
                  className="button button-secondary"
                  href={SHOP_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  Buy Now
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <footer className="site-footer">
        <p>© {new Date().getFullYear()} Bloodline Book. All rights reserved.</p>
      </footer>
    </main>
  );
}
