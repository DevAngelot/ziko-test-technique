import React, { useEffect, useRef, useState } from 'react';

const date = (value) => (value ? new Date(value).toLocaleString('fr-CD') : '—');
const status = (order) => (
  <span className={`badge ${order.status}`}>
    {order.status === 'paid' ? 'Payée' : 'En attente'}
  </span>
);

export default function OrdersPage({ api, money, onPayment }) {
  const [orders, setOrders] = useState([]);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const detailTitle = useRef(null);

  useEffect(() => {
    if (detail) detailTitle.current?.focus();
  }, [detail?.id]);

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const list = await api('/orders');
      setOrders(list);
      setDetail((previous) =>
        previous ? list.find((item) => item.id === previous.id) || null : null,
      );
    } catch (problem) {
      setError(problem.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function openOrder(item) {
    setLoading(true);
    setError('');
    setDetail(null);
    try {
      setDetail({
        ...(await api(`/orders/${item.id}`)),
        productName: item.productName,
      });
    } catch (problem) {
      setError(problem.message);
    } finally {
      setLoading(false);
    }
  }

  const visible = orders.filter(
    (item) => filter === 'all' || item.status === filter,
  );
  return (
    <>
      <section className="intro">
        <div>
          <span className="eyebrow">HISTORIQUE & SUIVI</span>
          <h1>Vos commandes.</h1>
          <p>
            Retrouvez chaque commande et cliquez pour consulter ses détails.
          </p>
        </div>
      </section>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <section className="card orders-section" aria-busy={loading}>
        <div className="section-title">
          <div>
            <span className="eyebrow">
              DE LA PLUS RÉCENTE À LA PLUS ANCIENNE
            </span>
            <h2>
              Commandes <span className="count">{orders.length}</span>
            </h2>
          </div>
          <button className="text-button" disabled={loading} onClick={refresh}>
            ↻ Actualiser les commandes
          </button>
        </div>
        <label className="order-filter">
          Statut
          <select
          aria-label="Filtrer par statut"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="all">Toutes les commandes</option>
            <option value="pending">En attente</option>
            <option value="paid">Payées</option>
          </select>
        </label>
        {loading && (
          <p role="status" className="hint">
            Chargement…
          </p>
        )}
        {!loading && !error && visible.length === 0 && (
          <div className="empty">
            <h3>
              Aucune commande{' '}
              {filter === 'all' ? 'pour le moment' : 'avec ce statut'}
            </h3>
            <p>Les nouvelles commandes apparaîtront ici.</p>
          </div>
        )}
        {visible.length > 0 && (
          <div className="orders-table-wrap">
            <table className="orders-table">
              <thead>
                <tr>
                  <th>Commande / date</th>
                  <th>Produit</th>
                  <th>Quantité</th>
                  <th>Total</th>
                  <th>Statut</th>
                  <th>
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => (
                  <tr
                    key={item.id}
                    className={detail?.id === item.id ? 'selected-order' : ''}
                    onClick={() => {
                      if (!loading) void openOrder(item);
                    }}
                  >
                    <td>
                      <strong title={item.id}>#{item.id.slice(0, 8)}</strong>
                      <small>{date(item.createdAt)}</small>
                    </td>
                    <td>{item.productName}</td>
                    <td>{item.quantity}</td>
                    <td>{money(item.totalPrice)}</td>
                    <td>{status(item)}</td>
                    <td>
                      <button
                        className="text-button"
                        disabled={loading}
                        aria-label={`Voir la commande ${item.id}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          void openOrder(item);
                        }}
                      >
                        Voir les détails →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {detail && (
        <section
          className="card order-detail-panel"
          aria-label="Détails de la commande"
        >
          <div className="section-title">
            <div>
              <span className="eyebrow">DÉTAILS DE LA COMMANDE</span>
              <h2 ref={detailTitle} tabIndex={-1}>
                Commande #{detail.id.slice(0, 8)}
              </h2>
            </div>
            <button className="text-button" onClick={() => setDetail(null)}>
              Fermer les détails ×
            </button>
          </div>
          {status(detail)}
          <dl className="order-details">
            <div>
              <dt>Identifiant complet</dt>
              <dd className="identifier">{detail.id}</dd>
            </div>
            <div>
              <dt>Produit</dt>
              <dd>{detail.productName}</dd>
            </div>
            <div>
              <dt>Identifiant du produit</dt>
              <dd>{detail.productId}</dd>
            </div>
            <div>
              <dt>Quantité</dt>
              <dd>{detail.quantity}</dd>
            </div>
            <div>
              <dt>Prix unitaire à la commande</dt>
              <dd>{money(detail.unitPrice)}</dd>
            </div>
            <div>
              <dt>Montant total</dt>
              <dd>
                <strong>{money(detail.totalPrice)}</strong>
              </dd>
            </div>
            <div>
              <dt>Créée le</dt>
              <dd>{date(detail.createdAt)}</dd>
            </div>
            <div>
              <dt>Payée le</dt>
              <dd>{date(detail.paidAt)}</dd>
            </div>
            <div>
              <dt>Identifiant du paiement</dt>
              <dd>{detail.paymentId || 'Aucun paiement enregistré'}</dd>
            </div>
          </dl>
          <button
            className="primary"
            disabled={loading}
            onClick={() => onPayment(detail)}
          >
            {detail.status === 'paid'
              ? 'Voir le paiement et tester le rejeu'
              : 'Passer au paiement'}{' '}
            <span>→</span>
          </button>
        </section>
      )}
    </>
  );
}
