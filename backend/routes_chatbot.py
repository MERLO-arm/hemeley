from fastapi import APIRouter, Request
from emergentintegrations.llm.chat import LlmChat, UserMessage
from dotenv import load_dotenv
import os
import logging
from datetime import datetime, timezone

load_dotenv()
logger = logging.getLogger(__name__)

chatbot_router = APIRouter()

SYSTEM_PROMPT = """Tu es HEME, l'assistant culinaire expert de la plateforme HEMELEY. Ton ton est professionnel, chaleureux et elegant.

Regles de langage:
- Incorpore naturellement les adjectifs 'beau' ou 'belle' pour decrire les produits ou l'experience (ex: 'Cette belle selection de desserts', 'Un beau plateau de sushis').
- Adapte ton accueil selon l'heure:
  - Matin (06h-11h): Propose des petits-dejeuners energisants.
  - Midi (11h-14h): Mets en avant les formules dejeuner rapides et gourmandes.
  - Apres-midi (14h-18h): Suggere une belle pause cafe ou un gouter.
  - Soir (18h-00h): Recommande nos plus belles specialites pour un diner reussi.

Objectif: Guider l'utilisateur vers la commande. Si l'utilisateur hesite, propose les recommandations du chef. Reste concis, ne fais pas de longs paragraphes. Utilise des emojis culinaires pour ponctuer tes phrases.

HEMELEY est une plateforme de decouverte et commande de street food a Douala, Cameroun. Les quartiers disponibles sont: Bonapriso, Akwa, Deido, Bonamoussadi, Bepanda, Makepe, Bonanjo, Ndokotti, Logbessou, Kotto.

Tu connais les menus disponibles en temps reel. Voici les menus actuels:
{MENUS_CONTEXT}

Information client:
{USER_CONTEXT}

Heure actuelle: {CURRENT_TIME}

Regles strictes:
- Ne propose JAMAIS un plat epuise (0 portions restantes)
- Mentionne les promotions et prix barres quand ils existent
- Si le client demande un plat specifique, verifie s'il est disponible
- Reste dans le contexte HEMELEY, ne parle pas d'autres plateformes
- Reponds en francais toujours
- Sois bref: max 3-4 phrases par reponse
"""

def get_time_context():
    now = datetime.now(timezone.utc)
    hour = (now.hour + 1) % 24  # WAT = UTC+1
    return f"{hour:02d}h{now.minute:02d} (heure de Douala)"

async def get_menus_context(db):
    menus = await db.menus.find({"is_active": True, "remaining_portions": {"$gt": 0}}, {"_id": 0, "image_base64": 0}).to_list(50)
    if not menus:
        return "Aucun menu disponible actuellement."
    lines = []
    for m in menus:
        promo = ""
        if m.get("original_price") and m["original_price"] > m.get("price", 0):
            promo = f" (PROMO: ancien prix {m['original_price']} FCFA, -{m.get('discount_percent', '')}%)"
        lines.append(f"- {m['name']} ({m.get('category','plat')}) | {m['price']} FCFA{promo} | {m['remaining_portions']} portions | {m.get('vendor_name','')} a {m.get('zone','')}")
    return "\n".join(lines)

def get_user_context(customer):
    if not customer:
        return "Client non connecte."
    return f"Client: {customer.get('pseudo','Inconnu')}, Points fidelite: {customer.get('loyalty_points',0)}, Niveau: {customer.get('loyalty_level','bronze')}"

# In-memory session store (simple approach)
chat_sessions = {}

@chatbot_router.post("/chat")
async def chat_with_heme(request: Request):
    db = request.state.db
    body = await request.json()
    message = body.get("message", "")
    session_id = body.get("session_id", "default")
    customer = body.get("customer")
    
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        return {"response": "Service temporairement indisponible. Reessayez plus tard.", "error": True}
    
    try:
        menus_ctx = await get_menus_context(db)
        time_ctx = get_time_context()
        user_ctx = get_user_context(customer)
        
        system = SYSTEM_PROMPT.replace("{MENUS_CONTEXT}", menus_ctx).replace("{CURRENT_TIME}", time_ctx).replace("{USER_CONTEXT}", user_ctx)
        
        if session_id not in chat_sessions:
            chat_sessions[session_id] = LlmChat(
                api_key=api_key,
                session_id=session_id,
                system_message=system
            ).with_model("openai", "gpt-4o-mini")
        
        chat = chat_sessions[session_id]
        user_msg = UserMessage(text=message)
        response = await chat.send_message(user_msg)
        
        # Store in DB
        await db.chat_messages.insert_one({
            "session_id": session_id,
            "customer_id": customer.get("id") if customer else None,
            "message": message,
            "response": response,
            "created_at": datetime.now(timezone.utc)
        })
        
        return {"response": response}
    except Exception as e:
        logger.error(f"Chatbot error: {e}")
        return {"response": "Hmm, je rencontre un petit souci technique. En attendant, n'hesitez pas a explorer nos menus directement ! 🍽️", "error": True}

@chatbot_router.post("/chat/reset")
async def reset_chat(request: Request):
    body = await request.json()
    session_id = body.get("session_id", "default")
    if session_id in chat_sessions:
        del chat_sessions[session_id]
    return {"success": True}
