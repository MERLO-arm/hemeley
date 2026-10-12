"""
HEMELEY Wallet & Escrow — Phase 3: Order lifecycle escrow tests
Covers:
 - POST /api/orders/  with payment_method='wallet' (success / insufficient / unknown phone / frozen / cash unchanged)
 - POST /api/orders/checkout (multi-vendor wallet hold, HTTPException re-raise on insufficient)
 - PUT /api/orders/{id}/status delivered  → release split (commission 15% + delivery + vendor)
 - PUT /api/orders/{id}/status delivered  idempotency
 - PUT /api/orders/{id}/status cancelled  → refund customer
 - PUT /api/orders/{id}/status non-wallet payment_method → no side effects
 - Permissions: vendor cross-update -> 403, super_admin can update
"""
import os
import pytest
import requests
from pathlib import Path


def _load_backend_env():
    env = {}
    p = Path("/app/backend/.env")
    if p.exists():
        for line in p.read_text().splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, _, v = line.partition("=")
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env


_BENV = _load_backend_env()
COMMISSION_RATE = float(_BENV.get("HEMELEY_COMMISSION_RATE", 0.15))

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", _BENV.get("REACT_APP_BACKEND_URL", "")).rstrip("/")
if not BASE_URL:
    fp = Path("/app/frontend/.env")
    if fp.exists():
        for line in fp.read_text().splitlines():
            if line.startswith("REACT_APP_BACKEND_URL"):
                BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")

CUSTOMER_PHONE = "690000001"
CUSTOMER_PASSWORD = "hemeley2024"


# ---------------- Fixtures ----------------

@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def customer_token(session):
    r = session.post(f"{BASE_URL}/api/customer/login",
                     json={"phone": CUSTOMER_PHONE, "password": CUSTOMER_PASSWORD})
    assert r.status_code == 200, f"customer login failed: {r.status_code} {r.text}"
    return r.json().get("token") or r.json().get("access_token")


@pytest.fixture(scope="session")
def admin_token(session):
    r = session.post(f"{BASE_URL}/api/auth/login",
                     json={"email": "admin@hemeley.com", "password": "hemeley2024"})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json().get("token") or r.json().get("access_token")


@pytest.fixture(scope="session")
def customer_profile(session, customer_token):
    r = session.get(f"{BASE_URL}/api/customer/profile", headers=_h(customer_token))
    assert r.status_code == 200, f"profile failed: {r.text}"
    return r.json()


@pytest.fixture(scope="session")
def menu_for_test(session):
    """Pick the first menu with remaining_portions > 0 from /api/menus."""
    r = session.get(f"{BASE_URL}/api/menus")
    assert r.status_code == 200, f"menus fetch failed: {r.text}"
    menus = r.json()
    for m in menus:
        if m.get("remaining_portions", 0) > 0 and m.get("price", 0) > 0:
            return m
    pytest.skip("No menus with remaining_portions > 0 found")


def _customer_wallet(session, admin_token, customer_id):
    r = session.get(f"{BASE_URL}/api/admin/wallets", headers=_h(admin_token),
                    params={"role": "customer"})
    assert r.status_code == 200, r.text
    for w in r.json():
        if w["user_id"] == customer_id:
            return w
    return None


def _system_wallet(session, admin_token, role):
    r = session.get(f"{BASE_URL}/api/admin/wallets", headers=_h(admin_token),
                    params={"role": role})
    assert r.status_code == 200, r.text
    items = r.json()
    return items[0] if items else None


def _adjust(session, admin_token, wallet_id, delta, reason="TEST_phase3 prefund"):
    r = session.post(f"{BASE_URL}/api/admin/wallets/{wallet_id}/adjust",
                     headers=_h(admin_token),
                     json={"delta": delta, "reason": reason})
    return r


def _ensure_balance(session, admin_token, customer_id, target):
    """Top up customer wallet to >= target FCFA."""
    w = _customer_wallet(session, admin_token, customer_id)
    if not w:
        # touch /api/wallet/me as customer to auto-create — caller must supply wallet
        return None
    cur = float(w.get("balance", 0))
    if cur < target:
        delta = round(target - cur + 1000, 2)
        r = _adjust(session, admin_token, w["id"], delta)
        assert r.status_code == 200, f"adjust failed: {r.text}"
        w = _customer_wallet(session, admin_token, customer_id)
    return w


def _make_order_payload(menu, payment_method, vendor_id=None, qty=1, phone=CUSTOMER_PHONE):
    item = {
        "menu_id": menu["id"],
        "menu_name": menu["name"],
        "quantity": qty,
        "price": menu["price"],
        "subtotal": menu["price"] * qty,
    }
    return {
        "customer_name": "TestClient",
        "customer_phone": phone,
        "customer_email": None,
        "items": [item],
        "vendor_id": vendor_id or menu["vendor_id"],
        "zone": menu.get("zone") or "Akwa",
        "payment_method": payment_method,
        "customer_note": "TEST_phase3",
    }


# ---------------- 1. Order with payment_method='wallet' ----------------

class TestWalletOrderHold:

    def test_create_wallet_order_holds_escrow(self, session, customer_token, admin_token,
                                              customer_profile, menu_for_test):
        # Ensure customer wallet exists by hitting /me
        session.get(f"{BASE_URL}/api/wallet/me", headers=_h(customer_token))
        cust = customer_profile
        # Pre-fund well above order total
        order_total_estimate = menu_for_test["price"] * 1
        _ensure_balance(session, admin_token, cust["id"], order_total_estimate + 5000)

        wbefore = _customer_wallet(session, admin_token, cust["id"])
        ebefore = _system_wallet(session, admin_token, "admin_escrow")

        payload = _make_order_payload(menu_for_test, "wallet")
        r = session.post(f"{BASE_URL}/api/orders/", json=payload)
        assert r.status_code == 200, f"order failed: {r.status_code} {r.text}"
        order_resp = r.json()
        # NOTE: route returns the Pydantic input object (still 'pending'); DB has the real status.
        # Re-fetch via GET to validate persisted side-effects.
        rg = session.get(f"{BASE_URL}/api/orders/{order_resp['id']}")
        assert rg.status_code == 200, rg.text
        order = rg.json()
        assert order["payment_status"] == "success", \
            f"expected DB payment_status=success, got {order['payment_status']} (response was {order_resp.get('payment_status')})"
        assert order["order_status"] == "confirmed"
        assert order.get("confirmed_at"), "confirmed_at should be set"
        total = float(order["total"])

        wafter = _customer_wallet(session, admin_token, cust["id"])
        eafter = _system_wallet(session, admin_token, "admin_escrow")
        assert round(float(wbefore["balance"]) - float(wafter["balance"]), 2) == round(total, 2), \
            f"customer not debited: before={wbefore['balance']} after={wafter['balance']} total={total}"
        assert round(float(eafter["balance"]) - float(ebefore["balance"]), 2) == round(total, 2)
        assert round(float(eafter["held_balance"]) - float(ebefore["held_balance"]), 2) == round(total, 2)

        # wallet_transactions: order_payment row exists
        tx = session.get(f"{BASE_URL}/api/admin/transactions",
                         headers=_h(admin_token), params={"order_id": order["id"]})
        assert tx.status_code == 200, tx.text
        types = [t["type"] for t in tx.json()]
        assert "order_payment" in types

        # Audit log
        au = session.get(f"{BASE_URL}/api/admin/audit-logs",
                         headers=_h(admin_token), params={"action": "order.escrow.hold"})
        assert au.status_code == 200, au.text
        assert any(l.get("target_resource") == order["id"] for l in au.json()), \
            "audit log order.escrow.hold not found for this order"

        # store created order id for later tests via class attr
        TestWalletOrderHold.order_id = order["id"]
        TestWalletOrderHold.order_total = total

    def test_wallet_order_insufficient_balance(self, session, customer_token, admin_token,
                                               customer_profile, menu_for_test):
        cust = customer_profile
        # Drain customer wallet
        w = _customer_wallet(session, admin_token, cust["id"])
        if w and float(w["balance"]) > 0:
            r = _adjust(session, admin_token, w["id"], -float(w["balance"]),
                        reason="TEST_drain")
            assert r.status_code == 200, r.text

        payload = _make_order_payload(menu_for_test, "wallet")
        r = session.post(f"{BASE_URL}/api/orders/", json=payload)
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"
        assert "insuffisant" in r.text.lower() or "solde" in r.text.lower(), r.text

    def test_wallet_order_unknown_phone(self, session, admin_token, menu_for_test):
        # Use a deliberately non-existent phone (not in customers/vendors seed)
        payload = _make_order_payload(menu_for_test, "wallet", phone="+237000000001")
        r = session.post(f"{BASE_URL}/api/orders/", json=payload)
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"
        assert "aucun compte client" in r.text.lower(), r.text

    def test_wallet_order_frozen_wallet(self, session, admin_token, customer_profile,
                                        menu_for_test):
        cust = customer_profile
        # Pre-fund + freeze
        _ensure_balance(session, admin_token, cust["id"], menu_for_test["price"] + 5000)
        w = _customer_wallet(session, admin_token, cust["id"])
        rf = session.put(f"{BASE_URL}/api/admin/wallets/{w['id']}/freeze",
                         headers=_h(admin_token))
        assert rf.status_code == 200, rf.text
        try:
            payload = _make_order_payload(menu_for_test, "wallet")
            r = session.post(f"{BASE_URL}/api/orders/", json=payload)
            assert r.status_code in (400, 403), f"expected 4xx, got {r.status_code}: {r.text}"
            # French error mentions frozen / bloqu / portefeuille
            body = r.text.lower()
            assert "frozen" in body or "bloqu" in body or "portefeuille" in body, r.text
        finally:
            session.put(f"{BASE_URL}/api/admin/wallets/{w['id']}/unfreeze",
                        headers=_h(admin_token))

    def test_cash_order_no_wallet_hold(self, session, admin_token, customer_profile, menu_for_test):
        cust = customer_profile
        wbefore = _customer_wallet(session, admin_token, cust["id"])
        b_before = float(wbefore["balance"]) if wbefore else 0.0

        payload = _make_order_payload(menu_for_test, "cash")
        r = session.post(f"{BASE_URL}/api/orders/", json=payload)
        assert r.status_code == 200, r.text
        order = r.json()
        assert order["payment_status"] == "pending"
        assert order["order_status"] == "pending"

        wafter = _customer_wallet(session, admin_token, cust["id"])
        b_after = float(wafter["balance"]) if wafter else 0.0
        assert round(b_after, 2) == round(b_before, 2), "cash order should not touch wallet"


# ---------------- 2. Multi-vendor checkout ----------------

class TestCheckoutCart:

    def test_checkout_wallet_holds_per_order(self, session, customer_token, admin_token,
                                             customer_profile, menu_for_test):
        cust = customer_profile
        # Top up
        _ensure_balance(session, admin_token, cust["id"], menu_for_test["price"] * 2 + 5000)
        wbefore = _customer_wallet(session, admin_token, cust["id"])

        payload = {
            "items": [{
                "menu_id": menu_for_test["id"],
                "menu_name": menu_for_test["name"],
                "price": menu_for_test["price"],
                "quantity": 1,
                "vendor_id": menu_for_test["vendor_id"],
                "vendor_name": menu_for_test.get("vendor_name", "vendor"),
            }],
            "total": menu_for_test["price"],
            "customer_info": {
                "pseudonym": "TestClient",
                "phone": CUSTOMER_PHONE,
                "payment_method": "wallet",
            },
        }
        r = session.post(f"{BASE_URL}/api/orders/checkout", json=payload)
        assert r.status_code == 200, f"checkout failed: {r.status_code} {r.text}"
        data = r.json()
        assert data["success"] is True
        assert data["total_orders"] >= 1
        # Re-fetch each order from DB (response Pydantic objects don't reflect status update)
        for o in data["orders"]:
            rg = session.get(f"{BASE_URL}/api/orders/{o['id']}")
            assert rg.status_code == 200, rg.text
            persisted = rg.json()
            assert persisted["payment_status"] == "success", \
                f"DB payment_status mismatch: {persisted['payment_status']} (resp={o.get('payment_status')})"
            assert persisted["order_status"] == "confirmed"

        wafter = _customer_wallet(session, admin_token, cust["id"])
        debited = round(float(wbefore["balance"]) - float(wafter["balance"]), 2)
        sum_total = round(sum(float(o["total"]) for o in data["orders"]), 2)
        assert debited == sum_total, f"expected debit {sum_total}, got {debited}"

    def test_checkout_insufficient_returns_400_not_500(self, session, admin_token,
                                                       customer_profile, menu_for_test):
        cust = customer_profile
        # Drain
        w = _customer_wallet(session, admin_token, cust["id"])
        if w and float(w["balance"]) > 0:
            _adjust(session, admin_token, w["id"], -float(w["balance"]), reason="TEST_drain2")

        payload = {
            "items": [{
                "menu_id": menu_for_test["id"],
                "menu_name": menu_for_test["name"],
                "price": menu_for_test["price"],
                "quantity": 1,
                "vendor_id": menu_for_test["vendor_id"],
                "vendor_name": menu_for_test.get("vendor_name", "vendor"),
            }],
            "total": menu_for_test["price"],
            "customer_info": {
                "pseudonym": "TestClient",
                "phone": CUSTOMER_PHONE,
                "payment_method": "wallet",
            },
        }
        r = session.post(f"{BASE_URL}/api/orders/checkout", json=payload)
        assert r.status_code == 400, f"expected 400 (HTTPException re-raised), got {r.status_code}: {r.text}"
        assert "insuffisant" in r.text.lower() or "solde" in r.text.lower(), r.text


# ---------------- 3. Release on delivered ----------------

class TestEscrowReleaseOnDelivered:

    @pytest.fixture(scope="class")
    def vendor_token_id(self, session):
        r = session.post(f"{BASE_URL}/api/auth/login",
                         json={"email": "vendeur@hemeley.com", "password": "hemeley2024"})
        if r.status_code != 200:
            pytest.skip(f"vendor login failed: {r.status_code} {r.text}")
        data = r.json()
        return data.get("token") or data.get("access_token"), data.get("user", {}).get("id")

    @pytest.fixture(scope="class")
    def vendor_token(self, vendor_token_id):
        return vendor_token_id[0]

    @pytest.fixture(scope="class")
    def vendor_menu(self, session, vendor_token_id):
        _, vendor_id = vendor_token_id
        assert vendor_id, "could not resolve vendor_id from login response"
        m = session.get(f"{BASE_URL}/api/menus")
        assert m.status_code == 200
        for menu in m.json():
            if menu.get("vendor_id") == vendor_id and menu.get("remaining_portions", 0) > 0:
                return menu, vendor_id
        pytest.skip(f"No menu with portions for vendor {vendor_id}")

    def _create_wallet_order(self, session, admin_token, customer_profile, menu, vendor_id):
        cust = customer_profile
        _ensure_balance(session, admin_token, cust["id"], menu["price"] + 5000)
        payload = _make_order_payload(menu, "wallet", vendor_id=vendor_id)
        r = session.post(f"{BASE_URL}/api/orders/", json=payload)
        assert r.status_code == 200, r.text
        # Re-fetch from DB because response object may be stale (Pydantic returns input)
        oid = r.json()["id"]
        rg = session.get(f"{BASE_URL}/api/orders/{oid}")
        assert rg.status_code == 200, rg.text
        return rg.json()

    def test_delivered_releases_split(self, session, admin_token, customer_profile,
                                      vendor_token, vendor_menu):
        menu, vendor_id = vendor_menu
        order = self._create_wallet_order(session, admin_token, customer_profile, menu, vendor_id)
        total = float(order["total"])

        ebefore = _system_wallet(session, admin_token, "admin_escrow")
        cbefore = _system_wallet(session, admin_token, "admin_commissions")
        # Vendor wallet
        wlist = session.get(f"{BASE_URL}/api/admin/wallets", headers=_h(admin_token),
                            params={"role": "vendor"}).json()
        vbefore = next((w for w in wlist if w["user_id"] == vendor_id), None)
        v_bal_before = float(vbefore["balance"]) if vbefore else 0.0

        r = session.put(f"{BASE_URL}/api/orders/{order['id']}/status",
                        headers=_h(vendor_token), json={"order_status": "delivered"})
        assert r.status_code == 200, f"delivered update failed: {r.status_code} {r.text}"

        eafter = _system_wallet(session, admin_token, "admin_escrow")
        cafter = _system_wallet(session, admin_token, "admin_commissions")
        wlist2 = session.get(f"{BASE_URL}/api/admin/wallets", headers=_h(admin_token),
                             params={"role": "vendor"}).json()
        vafter = next((w for w in wlist2 if w["user_id"] == vendor_id), None)
        v_bal_after = float(vafter["balance"]) if vafter else 0.0

        # escrow drained by total in both balance & held
        assert round(float(ebefore["balance"]) - float(eafter["balance"]), 2) == round(total, 2)
        assert round(float(ebefore["held_balance"]) - float(eafter["held_balance"]), 2) == round(total, 2)

        # commission = 15% of total
        commission = round(total * COMMISSION_RATE, 2)
        assert round(float(cafter["balance"]) - float(cbefore["balance"]), 2) == commission

        # vendor share = total - commission - delivery_fee
        delivery_fee = float(order.get("delivery_fee") or 0)
        expected_v = round(total - commission - delivery_fee, 2)
        if expected_v < 0:
            expected_v = 0.0
        assert round(v_bal_after - v_bal_before, 2) == expected_v, \
            f"vendor share mismatch: expected {expected_v}, got {v_bal_after - v_bal_before}"

        # tx ledger has commission + escrow_release_vendor
        tx = session.get(f"{BASE_URL}/api/admin/transactions", headers=_h(admin_token),
                         params={"order_id": order["id"]}).json()
        types = [t["type"] for t in tx]
        assert "commission" in types
        assert "escrow_release_vendor" in types
        if delivery_fee > 0 and order.get("delivery_id"):
            assert "escrow_release_delivery" in types

        # Audit log
        au = session.get(f"{BASE_URL}/api/admin/audit-logs", headers=_h(admin_token),
                         params={"action": "order.escrow.release"}).json()
        assert any(l.get("target_resource") == order["id"] for l in au)

        # store for idempotency test
        TestEscrowReleaseOnDelivered.delivered_order_id = order["id"]
        TestEscrowReleaseOnDelivered.delivered_order_total = total

    def test_delivered_idempotent(self, session, admin_token, vendor_token):
        order_id = getattr(TestEscrowReleaseOnDelivered, "delivered_order_id", None)
        if not order_id:
            pytest.skip("previous delivered test did not run")
        # Count existing release tx
        before = session.get(f"{BASE_URL}/api/admin/transactions", headers=_h(admin_token),
                             params={"order_id": order_id}).json()
        n_release_before = sum(1 for t in before if t["type"] == "escrow_release_vendor")

        # Second update — should not double-pay
        r = session.put(f"{BASE_URL}/api/orders/{order_id}/status",
                        headers=_h(vendor_token), json={"order_status": "delivered"})
        # Either 200 (idempotent inside) or 400 (status already delivered) — both acceptable
        assert r.status_code in (200, 400), r.text

        after = session.get(f"{BASE_URL}/api/admin/transactions", headers=_h(admin_token),
                            params={"order_id": order_id}).json()
        n_release_after = sum(1 for t in after if t["type"] == "escrow_release_vendor")
        assert n_release_after == n_release_before, \
            f"release tx duplicated: before={n_release_before} after={n_release_after}"

    def test_delivered_non_wallet_no_side_effects(self, session, admin_token, vendor_token,
                                                  vendor_menu):
        menu, vendor_id = vendor_menu
        # Cash order
        payload = _make_order_payload(menu, "cash", vendor_id=vendor_id)
        r = session.post(f"{BASE_URL}/api/orders/", json=payload)
        assert r.status_code == 200, r.text
        order = r.json()

        ebefore = _system_wallet(session, admin_token, "admin_escrow")
        cbefore = _system_wallet(session, admin_token, "admin_commissions")
        r2 = session.put(f"{BASE_URL}/api/orders/{order['id']}/status",
                         headers=_h(vendor_token), json={"order_status": "delivered"})
        assert r2.status_code == 200, r2.text

        eafter = _system_wallet(session, admin_token, "admin_escrow")
        cafter = _system_wallet(session, admin_token, "admin_commissions")
        assert float(ebefore["balance"]) == float(eafter["balance"])
        assert float(cbefore["balance"]) == float(cafter["balance"])


# ---------------- 4. Refund on cancellation ----------------

class TestEscrowRefundOnCancel:

    @pytest.fixture(scope="class")
    def vendor_token_id(self, session):
        r = session.post(f"{BASE_URL}/api/auth/login",
                         json={"email": "vendeur@hemeley.com", "password": "hemeley2024"})
        if r.status_code != 200:
            pytest.skip(f"vendor login failed: {r.text}")
        data = r.json()
        return data.get("token") or data.get("access_token"), data.get("user", {}).get("id")

    @pytest.fixture(scope="class")
    def vendor_token(self, vendor_token_id):
        return vendor_token_id[0]

    @pytest.fixture(scope="class")
    def vendor_menu(self, session, vendor_token_id):
        _, vendor_id = vendor_token_id
        assert vendor_id
        m = session.get(f"{BASE_URL}/api/menus").json()
        for menu in m:
            if menu.get("vendor_id") == vendor_id and menu.get("remaining_portions", 0) > 0:
                return menu, vendor_id
        pytest.skip("no menu for cancel test")

    def test_cancel_wallet_order_refunds_customer(self, session, admin_token,
                                                  customer_profile, vendor_token, vendor_menu):
        menu, vendor_id = vendor_menu
        cust = customer_profile
        _ensure_balance(session, admin_token, cust["id"], menu["price"] + 5000)
        payload = _make_order_payload(menu, "wallet", vendor_id=vendor_id)
        r = session.post(f"{BASE_URL}/api/orders/", json=payload)
        assert r.status_code == 200, r.text
        order = r.json()
        total = float(order["total"])

        wbefore = _customer_wallet(session, admin_token, cust["id"])
        ebefore = _system_wallet(session, admin_token, "admin_escrow")

        r2 = session.put(f"{BASE_URL}/api/orders/{order['id']}/status",
                         headers=_h(vendor_token), json={"order_status": "cancelled"})
        assert r2.status_code == 200, f"cancel failed: {r2.status_code} {r2.text}"

        wafter = _customer_wallet(session, admin_token, cust["id"])
        eafter = _system_wallet(session, admin_token, "admin_escrow")
        assert round(float(wafter["balance"]) - float(wbefore["balance"]), 2) == round(total, 2)
        assert round(float(ebefore["balance"]) - float(eafter["balance"]), 2) == round(total, 2)
        assert round(float(ebefore["held_balance"]) - float(eafter["held_balance"]), 2) == round(total, 2)

        tx = session.get(f"{BASE_URL}/api/admin/transactions", headers=_h(admin_token),
                         params={"order_id": order["id"]}).json()
        types = [t["type"] for t in tx]
        assert "refund" in types

        au = session.get(f"{BASE_URL}/api/admin/audit-logs", headers=_h(admin_token),
                         params={"action": "order.escrow.refund"}).json()
        assert any(l.get("target_resource") == order["id"] for l in au)

    def test_cancel_non_wallet_no_side_effects(self, session, admin_token, vendor_token, vendor_menu):
        menu, vendor_id = vendor_menu
        payload = _make_order_payload(menu, "cash", vendor_id=vendor_id)
        r = session.post(f"{BASE_URL}/api/orders/", json=payload)
        assert r.status_code == 200, r.text
        order = r.json()

        ebefore = _system_wallet(session, admin_token, "admin_escrow")
        r2 = session.put(f"{BASE_URL}/api/orders/{order['id']}/status",
                         headers=_h(vendor_token), json={"order_status": "cancelled"})
        assert r2.status_code == 200, r2.text
        eafter = _system_wallet(session, admin_token, "admin_escrow")
        assert float(ebefore["balance"]) == float(eafter["balance"])
        assert float(ebefore["held_balance"]) == float(eafter["held_balance"])


# ---------------- 5. Permissions ----------------

class TestUpdateOrderStatusPermissions:

    def test_super_admin_can_update_any_order(self, session, admin_token, customer_profile, menu_for_test):
        cust = customer_profile
        _ensure_balance(session, admin_token, cust["id"], menu_for_test["price"] + 5000)
        payload = _make_order_payload(menu_for_test, "wallet")
        r = session.post(f"{BASE_URL}/api/orders/", json=payload)
        assert r.status_code == 200, r.text
        order = r.json()
        r2 = session.put(f"{BASE_URL}/api/orders/{order['id']}/status",
                         headers=_h(admin_token), json={"order_status": "preparing"})
        assert r2.status_code == 200, f"super_admin update failed: {r2.text}"

    def test_other_vendor_cannot_update(self, session, admin_token, customer_profile, menu_for_test):
        # Find a DIFFERENT vendor than the one owning menu_for_test.vendor_id
        vlist_resp = session.get(f"{BASE_URL}/api/admin/wallets", headers=_h(admin_token),
                                 params={"role": "vendor"})
        # Can't easily get a different vendor's password; use existing default vendor login but pick a menu from another
        # Try to pick a DIFFERENT menu than vendor's
        menus = session.get(f"{BASE_URL}/api/menus").json()
        # Login default vendor
        rv = session.post(f"{BASE_URL}/api/vendor/login",
                          json={"email": "vendeur@hemeley.com", "password": "hemeley2024"})
        if rv.status_code != 200:
            rv = session.post(f"{BASE_URL}/api/auth/login",
                              json={"email": "vendeur@hemeley.com", "password": "hemeley2024"})
        if rv.status_code != 200:
            pytest.skip("vendor login failed")
        vt = rv.json().get("token") or rv.json().get("access_token")
        # vendor profile
        prof = session.get(f"{BASE_URL}/api/vendor/profile", headers=_h(vt))
        my_vid = prof.json().get("id") if prof.status_code == 200 else None
        # find a menu NOT owned by this vendor
        other = next((m for m in menus
                      if m.get("vendor_id") != my_vid and m.get("remaining_portions", 0) > 0), None)
        if not other:
            pytest.skip("no other vendor menu available")
        cust = customer_profile
        _ensure_balance(session, admin_token, cust["id"], other["price"] + 5000)
        payload = _make_order_payload(other, "wallet", vendor_id=other["vendor_id"])
        r = session.post(f"{BASE_URL}/api/orders/", json=payload)
        assert r.status_code == 200, r.text
        oid = r.json()["id"]
        r2 = session.put(f"{BASE_URL}/api/orders/{oid}/status",
                         headers=_h(vt), json={"order_status": "preparing"})
        assert r2.status_code == 403, f"expected 403, got {r2.status_code}: {r2.text}"
