import React, { useEffect, useRef, useState } from 'react';
import OrdersPage from './OrdersPage.jsx';

const money = (value) =>
  `${new Intl.NumberFormat('fr-CD').format(BigInt(value))} CDF`;
const max = 2147483647;
const uuid =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const pages = {
  '#creer-produit': {
    title: 'Créer un produit',
    description:
      'Ajoutez un produit avec son prix en francs congolais et son stock.',
  },
  '#catalogue': {
    title: 'Liste des produits',
    description: 'Consultez le catalogue et choisissez un produit à commander.',
  },
  '#commande': {
    title: 'Passer une commande',
    description:
      'Choisissez un produit et une quantité. Le stock est vérifié avant la création.',
  },
  '#paiement': {
    title: 'Payer une commande',
    description:
      'Enregistrez le paiement et vérifiez qu’un rejeu ne décompte pas le stock à nouveau.',
  },
  '#commandes': { title: 'Commandes' },
};
const currentPage = () =>
  pages[window.location.hash] ? window.location.hash : '#creer-produit';

const fieldRules = {
  name: 'Nom du produit : entre 1 et 200 caractères, sans nom vide.',
  price: 'Prix : un entier entre 1 et 2 147 483 647 CDF.',
  stock: 'Stock : un entier entre 0 et 2 147 483 647.',
  quantity: 'Quantité : un entier entre 1 et 2 147 483 647.',
  productId: 'Sélectionnez un produit valide.',
  paymentId:
    'Identifiant de paiement : 1 à 100 lettres, chiffres, tirets ou underscores, sans espaces.',
  orderId: 'Saisissez un identifiant de commande UUID valide.',
};
const refusalMessages = {
  ORDER_ALREADY_PAID:
    'Paiement refusé : cette commande est déjà payée avec un autre identifiant. Aucun nouveau paiement ni décompte de stock effectué.',
  PAYMENT_ID_ALREADY_USED:
    'Paiement refusé : cet identifiant appartient déjà à une autre commande. Vérifiez la référence du paiement ; cette commande reste en attente.',
  ORDER_NOT_FOUND:
    'Commande introuvable. Vérifiez son identifiant ou sélectionnez une commande dans le menu Commandes.',
  PRODUCT_NOT_FOUND:
    'Produit introuvable. Actualisez la liste des produits et sélectionnez un produit existant.',
};

async function api(path, body) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error(
      path.endsWith('/pay')
        ? 'Confirmation du paiement non reçue. Consultez la commande ou réessayez avec le même identifiant de paiement pour éviter un double traitement.'
        : 'Connexion impossible. Vérifiez que le serveur de l’API est démarré, puis actualisez.',
    );
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    const problem = data?.error;
    let message =
      refusalMessages[problem?.code] ||
      problem?.message ||
      'Le serveur est indisponible. Réessayez dans un instant.';
    if (problem?.code === 'VALIDATION_ERROR') {
      const details = [
        ...new Set(
          (problem.fields || []).map(
            ({ field }) =>
              fieldRules[field] ||
              (field === 'body'
                ? 'Vérifiez les champs obligatoires et supprimez les champs non attendus.'
                : 'Vérifiez le format de l’identifiant et les champs saisis.'),
          ),
        ),
      ];
      message = `Données invalides. ${details.join(' ')}`;
    }
    if (problem?.code === 'INSUFFICIENT_STOCK') {
      message = path.endsWith('/pay')
        ? 'Paiement refusé : le stock disponible ne suffit plus. La commande reste en attente ; aucun paiement ni décompte de stock effectué.'
        : 'Commande refusée : stock insuffisant. Réduisez la quantité ou choisissez un autre produit. Aucune commande créée.';
    }
    const error = new Error(message);
    error.code = problem?.code;
    throw error;
  }
  return data;
}

export default function App() {
  const [view, setView] = useState(currentPage);
  const [products, setProducts] = useState([]);
  const [selected, setSelected] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [order, setOrder] = useState(null);
  const [lookup, setLookup] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [lastPayment, setLastPayment] = useState(null);
  const noticeRef = useRef(null);
  useEffect(() => {
    if (notice?.type === 'error') noticeRef.current?.focus();
  }, [notice]);
  const product = products.find((item) => item.id === selected);

  async function refresh() {
    try {
      const list = await api('/products');
      setProducts(list);
      setOnline(true);
      setLoaded(true);
    } catch (error) {
      setOnline(false);
      throw error;
    }
  }

  async function run(action) {
    setBusy(true);
    setNotice(null);
    try {
      await action();
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void run(refresh);
    const navigate = () => {
      setView(currentPage());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, []);

  async function createProduct(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const name = String(fields.get('name')).trim();
    if (!name) {
      setNotice({
        type: 'error',
        text: 'Le nom du produit ne peut pas être vide.',
      });
      return;
    }
    await run(async () => {
      const created = await api('/products', {
        name,
        price: Number(fields.get('price')),
        stock: Number(fields.get('stock')),
      });
      setSelected(created.id);
      form.reset();
      await refresh();
      setNotice({
        type: 'success',
        text: `« ${created.name} » a été ajouté au catalogue.`,
      });
    });
  }

  async function createOrder(event) {
    event.preventDefault();
    await run(async () => {
      const created = await api('/orders', {
        productId: selected,
        quantity: Number(quantity),
      });
      setOrder(created);
      setLookup(created.id);
      setPaymentId(`MM-${crypto.randomUUID()}`);
      setLastPayment(null);
      await refresh();
      setNotice({
        type: 'success',
        text: 'Commande créée en attente. Le stock sera diminué au paiement.',
      });
      window.location.hash = 'paiement';
    });
  }

  async function pay(id) {
    await run(async () => {
      setLastPayment(null);
      const result = await api(`/orders/${order.id}/pay`, {
        paymentId: id.trim(),
      });
      setOrder(result.order);
      setLastPayment(result);
      // Keep the successful payment visible even if refreshing the catalogue fails.
      const message = result.replayed
        ? 'Double paiement bloqué : ce paiement est déjà enregistré. La commande reste payée et le stock n’a pas été diminué une seconde fois.'
        : result.message;
      setNotice({ type: result.replayed ? 'error' : 'success', text: message });
      try {
        await refresh();
      } catch {
        setNotice({
          type: 'error',
          text: `${message} Le catalogue n’a pas pu être actualisé ; utilisez Actualiser dans la liste des produits.`,
        });
      }
    });
  }

  async function findOrder(event) {
    event.preventDefault();
    await run(async () => {
      setOrder(null);
      setLastPayment(null);
      const found = await api(`/orders/${lookup.trim()}`);
      setOrder(found);
      setPaymentId(found.paymentId || `MM-${crypto.randomUUID()}`);
      setSelected(found.productId);
      setLastPayment(null);
      setNotice({
        type: 'success',
        text: 'Commande récupérée depuis la base de données.',
      });
    });
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="#">
          ziko<span>●</span>
        </a>
        <span className="workspace">BOUTIQUE · KINSHASA</span>
        <nav aria-label="Navigation">
          {Object.entries(pages).map(([hash, page], index) => (
            <a
              key={hash}
              href={hash}
              aria-current={view === hash ? 'page' : undefined}
            >
              <span aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span>{page.title}</span>
            </a>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="eyebrow">LE PRINCIPE</span>
          <small>
            Une démonstration simple, de la création du produit au paiement.
          </small>
        </div>
        <span className="demo-label">Environnement de démonstration</span>
      </aside>
      <main
        onInvalid={(event) => {
          setLastPayment(null);
          event.target.setAttribute('aria-invalid', 'true');
          setNotice({
            type: 'error',
            text: `Données invalides. ${fieldRules[event.target.name] || 'Vérifiez les champs obligatoires et leur format.'}`,
          });
        }}
        onInput={(event) => event.target.removeAttribute('aria-invalid')}
      >
        <header>
          <span className="breadcrumb">
            Boutique / <strong>{pages[view].title}</strong>
          </span>
          <span className={`connection ${online === true ? 'connected' : ''}`}>
            <i />
            {online === null
              ? 'Connexion…'
              : online
                ? 'API connectée'
                : 'API indisponible'}
          </span>
        </header>
        {view === '#commandes' ? (
          <OrdersPage
            api={api}
            money={money}
            onPayment={(item) => {
              setOrder(item);
              setLookup(item.id);
              setPaymentId(item.paymentId || `MM-${crypto.randomUUID()}`);
              setSelected(item.productId);
              setLastPayment(null);
              setNotice(null);
              window.location.hash = 'paiement';
            }}
          />
        ) : (
          <>
            <section className="intro">
              <div>
                <span className="eyebrow">VOTRE ESPACE DE PRÉSENTATION</span>
                <h1>{pages[view].title}</h1>
                <p>{pages[view].description}</p>
              </div>
              <span className="currency">
                CDF <small>Franc congolais</small>
              </span>
            </section>
            {notice && (
              <div
                ref={noticeRef}
                tabIndex={-1}
                role={notice.type === 'error' ? 'alert' : 'status'}
                className={`notice ${notice.type}`}
              >
                <span>{notice.text}</span>
                <button
                  aria-label="Fermer le message"
                  onClick={() => setNotice(null)}
                >
                  ×
                </button>
              </div>
            )}
            {view === '#creer-produit' && (
              <div className="page-panel">
                <section className="card">
                  <div className="section-title">
                    <div>
                      <span className="eyebrow">01 / CATALOGUE</span>
                      <h2>Ajouter un produit</h2>
                    </div>
                    <span className="square-icon">＋</span>
                  </div>
                  <form onSubmit={createProduct}>
                    <fieldset disabled={busy}>
                      <label>
                        Nom du produit
                        <input
                          name="name"
                          required
                          maxLength={200}
                          placeholder="Ex. Café de Kinshasa"
                        />
                      </label>
                      <div className="two-columns">
                        <label>
                          Prix unitaire (CDF)
                          <input
                            name="price"
                            type="number"
                            required
                            min="1"
                            max={max}
                            step="1"
                            placeholder="2500"
                          />
                        </label>
                        <label>
                          Stock disponible
                          <input
                            name="stock"
                            type="number"
                            required
                            min="0"
                            max={max}
                            step="1"
                            placeholder="10"
                          />
                        </label>
                      </div>
                      <p className="hint">
                        Prix entier positif · Stock entier, à partir de zéro.
                      </p>
                      <button className="primary" type="submit">
                        Ajouter au catalogue <span>↗</span>
                      </button>
                    </fieldset>
                  </form>
                  <a className="page-next" href="#catalogue">
                    Voir la liste des produits →
                  </a>
                </section>
              </div>
            )}
            {view === '#catalogue' && (
              <div className="page-panel catalogue-page">
                <section className="card">
                  <div className="section-title">
                    <div>
                      <span className="eyebrow">LES PRODUITS</span>
                      <h2>
                        Votre catalogue{' '}
                        <span className="count">{products.length}</span>
                      </h2>
                    </div>
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => run(refresh)}
                    >
                      ↻ Actualiser
                    </button>
                  </div>
                  <div className="product-list">
                    {!loaded ? (
                      <div className="empty">
                        {online === false
                          ? 'Démarrez l’API, puis actualisez le catalogue.'
                          : 'Chargement du catalogue…'}
                      </div>
                    ) : products.length === 0 ? (
                      <div className="empty">
                        <span>▦</span>
                        <h3>Tout commence par un produit</h3>
                        <p>
                          Ajoutez votre premier article dans le menu Créer un
                          produit.
                        </p>
                        <a className="page-next" href="#creer-produit">
                          Créer un produit →
                        </a>
                      </div>
                    ) : (
                      products.map((item) => (
                        <button
                          type="button"
                          disabled={busy}
                          className={`product ${selected === item.id ? 'selected' : ''}`}
                          key={item.id}
                          onClick={() => {
                            setSelected(item.id);
                            setQuantity('1');
                            window.location.hash = 'commande';
                          }}
                        >
                          <span className="product-avatar">
                            {item.name.slice(0, 1).toUpperCase()}
                          </span>
                          <span className="product-info">
                            <strong>{item.name}</strong>
                            <small>{money(item.price)}</small>
                          </span>
                          <span
                            className={`stock ${item.stock === 0 ? 'out' : ''}`}
                          >
                            {item.stock === 0
                              ? 'Épuisé'
                              : `${item.stock} en stock`}
                          </span>
                          <span className="radio" />
                        </button>
                      ))
                    )}
                  </div>
                  <p className="hint">
                    Sélectionnez un produit pour préparer une commande.
                  </p>
                </section>
              </div>
            )}
            {view === '#commande' && (
              <div className="page-panel">
                <section className="card">
                  <div className="section-title">
                    <div>
                      <span className="eyebrow">02 / COMMANDE</span>
                      <h2>Préparer la commande</h2>
                    </div>
                  </div>
                  <form onSubmit={createOrder}>
                    <fieldset disabled={busy}>
                      <label>
                        Produit
                        <select
                          name="productId"
                          aria-label="Produit à commander"
                          required
                          value={selected}
                          onChange={(e) => setSelected(e.target.value)}
                        >
                          <option value="">Choisir un produit</option>
                          {products.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name} — stock : {item.stock}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Quantité
                        <input
                          name="quantity"
                          type="number"
                          min="1"
                          max={max}
                          step="1"
                          required
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                        />
                      </label>
                      <div className="total">
                        <span>Total estimé</span>
                        <strong>
                          {product &&
                          /^\d+$/.test(quantity) &&
                          Number(quantity) <= max
                            ? money(BigInt(product.price) * BigInt(quantity))
                            : '—'}
                        </strong>
                      </div>
                      <p className="hint">
                        Un produit par commande. Le stock est vérifié par l’API
                        ; il n’est pas réservé avant le paiement.
                      </p>
                      <button
                        className="primary"
                        disabled={!selected}
                        type="submit"
                      >
                        Créer la commande <span>→</span>
                      </button>
                    </fieldset>
                  </form>
                </section>
              </div>
            )}
            {view === '#paiement' && (
              <div className="page-panel">
                <section className="card payment">
                  <div className="section-title">
                    <div>
                      <span className="eyebrow">03 / PAIEMENT & SUIVI</span>
                      <h2>
                        {order ? 'Votre commande' : 'Prête pour la suite'}
                      </h2>
                    </div>
                    {order && (
                      <span className={`badge ${order.status}`}>
                        {order.status === 'paid' ? 'Payée' : 'En attente'}
                      </span>
                    )}
                  </div>
                  {order ? (
                    <>
                      <dl className="order-details">
                        <div>
                          <dt>Identifiant de commande</dt>
                          <dd className="identifier">{order.id}</dd>
                        </div>
                        <div>
                          <dt>Produit</dt>
                          <dd>
                            {products.find((p) => p.id === order.productId)
                              ?.name || order.productId}
                          </dd>
                        </div>
                        <div>
                          <dt>Quantité</dt>
                          <dd>{order.quantity}</dd>
                        </div>
                        <div>
                          <dt>Montant de la commande</dt>
                          <dd>
                            <strong>{money(order.totalPrice)}</strong>
                          </dd>
                        </div>
                      </dl>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          void pay(paymentId);
                        }}
                      >
                        <fieldset disabled={busy}>
                          <label>
                            Identifiant de paiement
                            <input
                              name="paymentId"
                              required
                              value={paymentId}
                              maxLength={100}
                              pattern="[A-Za-z0-9_\-]+"
                              title="Lettres, chiffres, tirets et underscores uniquement."
                              onChange={(e) => setPaymentId(e.target.value)}
                            />
                          </label>
                          <p className="hint">
                            Confirmation simulée : aucun compte Mobile Money
                            n’est débité.
                          </p>
                          <button className="primary" type="submit">
                            {order.status === 'paid'
                              ? 'Envoyer cet identifiant'
                              : 'Confirmer le paiement'}{' '}
                            <span>→</span>
                          </button>
                          {order.status === 'paid' && (
                            <button
                              type="button"
                              className="secondary"
                              onClick={() => {
                                setPaymentId(order.paymentId);
                                void pay(order.paymentId);
                              }}
                            >
                              ↻ Rejouer le même paiement
                            </button>
                          )}
                        </fieldset>
                      </form>
                      {lastPayment && (
                        <div
                          className={`payment-result ${lastPayment.replayed ? 'refused' : ''}`}
                          role={lastPayment.replayed ? 'alert' : 'status'}
                        >
                          <strong>
                            {lastPayment.replayed
                              ? 'Double paiement bloqué'
                              : 'Paiement enregistré'}
                          </strong>
                          <p>
                            {lastPayment.replayed
                              ? 'Le même paiement a été reçu à nouveau. Le stock n’a pas été diminué une seconde fois.'
                              : 'La commande est payée et le catalogue a été actualisé.'}
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="empty payment-empty">
                      <span>↗</span>
                      <h3>Votre commande apparaîtra ici</h3>
                      <p>
                        Créez une commande pour la payer, puis rejouez le
                        paiement pour vérifier la protection.
                      </p>
                    </div>
                  )}
                  <form className="lookup" onSubmit={findOrder}>
                    <fieldset disabled={busy}>
                      <label>
                        Consulter une commande par son identifiant
                        <div className="lookup-row">
                          <input
                            name="orderId"
                            required
                            value={lookup}
                            placeholder="Identifiant UUID de la commande"
                            onChange={(e) => setLookup(e.target.value)}
                            pattern={uuid.source.slice(1, -1)}
                          />
                          <button type="submit" className="secondary">
                            Consulter
                          </button>
                        </div>
                      </label>
                    </fieldset>
                  </form>
                </section>
              </div>
            )}
          </>
        )}
        <footer>
          <strong>
            ziko<span>●</span>
          </strong>
          <span>Produits · Commandes · Paiements</span>
          <span>Présentation du test technique</span>
        </footer>
      </main>
    </div>
  );
}
