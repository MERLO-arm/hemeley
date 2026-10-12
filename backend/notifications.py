"""
Notification Service for HEMELEY
Supports Email and WhatsApp notifications
"""
import os
import smtplib
import httpx
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging

logger = logging.getLogger(__name__)

# Email Configuration (using SMTP - works with Gmail, etc.)
SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
FROM_EMAIL = os.environ.get("FROM_EMAIL", "noreply@hemeley.com")

# WhatsApp Configuration (using CallMeBot free API for demo)
WHATSAPP_API_KEY = os.environ.get("WHATSAPP_API_KEY", "")

async def send_email(to_email: str, subject: str, body_html: str, body_text: str = None):
    """Send email notification"""
    if not SMTP_USER or not SMTP_PASSWORD:
        logger.warning("Email not configured - SMTP credentials missing")
        return {"success": False, "error": "Email not configured"}
    
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = FROM_EMAIL
        msg["To"] = to_email
        
        # Add plain text version
        if body_text:
            msg.attach(MIMEText(body_text, "plain"))
        
        # Add HTML version
        msg.attach(MIMEText(body_html, "html"))
        
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(FROM_EMAIL, to_email, msg.as_string())
        
        logger.info(f"Email sent to {to_email}")
        return {"success": True}
    
    except Exception as e:
        logger.error(f"Failed to send email: {str(e)}")
        return {"success": False, "error": str(e)}

async def send_whatsapp(phone: str, message: str):
    """Send WhatsApp notification using CallMeBot API (free for personal use)"""
    if not WHATSAPP_API_KEY:
        logger.warning("WhatsApp not configured - API key missing")
        return {"success": False, "error": "WhatsApp not configured"}
    
    try:
        # Format phone number (remove leading 0, add country code)
        clean_phone = phone.lstrip("0").lstrip("+")
        if not clean_phone.startswith("237"):
            clean_phone = "237" + clean_phone
        
        # CallMeBot API
        url = f"https://api.callmebot.com/whatsapp.php?phone={clean_phone}&text={message}&apikey={WHATSAPP_API_KEY}"
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=30)
            
        if response.status_code == 200:
            logger.info(f"WhatsApp sent to {phone}")
            return {"success": True}
        else:
            return {"success": False, "error": f"API returned {response.status_code}"}
    
    except Exception as e:
        logger.error(f"Failed to send WhatsApp: {str(e)}")
        return {"success": False, "error": str(e)}

def generate_order_confirmation_email(order: dict) -> tuple:
    """Generate order confirmation email HTML and text"""
    items_html = ""
    items_text = ""
    
    for item in order.get("items", []):
        items_html += f"""
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">{item.get('menu_name', 'N/A')}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">{item.get('quantity', 1)}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">{item.get('subtotal', 0):,} FCFA</td>
        </tr>
        """
        items_text += f"  - {item.get('menu_name', 'N/A')} x{item.get('quantity', 1)} = {item.get('subtotal', 0):,} FCFA\n"
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body {{ font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; }}
            .container {{ max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; }}
            .header {{ background: #E07B39; color: white; padding: 30px; text-align: center; }}
            .header h1 {{ margin: 0; font-size: 32px; letter-spacing: 2px; }}
            .content {{ padding: 30px; }}
            .order-info {{ background: #f9f9f9; border-radius: 12px; padding: 20px; margin: 20px 0; }}
            .total {{ font-size: 24px; color: #E07B39; font-weight: bold; }}
            .footer {{ background: #333; color: #999; padding: 20px; text-align: center; font-size: 12px; }}
            table {{ width: 100%; border-collapse: collapse; }}
            th {{ background: #E07B39; color: white; padding: 12px; text-align: left; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>HEMELEY</h1>
                <p>Les saveurs qui font vibrer 🍛</p>
            </div>
            <div class="content">
                <h2>✅ Commande Confirmée!</h2>
                <p>Bonjour <strong>{order.get('customer_name', 'Client')}</strong>,</p>
                <p>Votre commande a été confirmée et sera préparée sous peu.</p>
                
                <div class="order-info">
                    <p><strong>N° Commande:</strong> #{order.get('id', 'N/A')[:8]}</p>
                    <p><strong>Adresse:</strong> {order.get('customer_address', 'Non spécifiée')}</p>
                </div>
                
                <h3>Détails de la commande</h3>
                <table>
                    <tr>
                        <th>Article</th>
                        <th style="text-align: center;">Qté</th>
                        <th style="text-align: right;">Prix</th>
                    </tr>
                    {items_html}
                </table>
                
                <div style="text-align: right; margin-top: 20px;">
                    <span class="total">Total: {order.get('total', 0):,} FCFA</span>
                </div>
                
                <p style="margin-top: 30px;">Merci de votre confiance!</p>
            </div>
            <div class="footer">
                <p>© 2026 HEMELEY - Street Food Douala</p>
                <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    text = f"""
HEMELEY - Confirmation de Commande

Bonjour {order.get('customer_name', 'Client')},

Votre commande a été confirmée!

N° Commande: #{order.get('id', 'N/A')[:8]}
Adresse: {order.get('customer_address', 'Non spécifiée')}

Articles:
{items_text}
Total: {order.get('total', 0):,} FCFA

Merci de votre confiance!

---
HEMELEY - Les saveurs qui font vibrer
    """
    
    return html, text

def generate_order_whatsapp_message(order: dict) -> str:
    """Generate WhatsApp order confirmation message"""
    items = ", ".join([f"{item.get('menu_name')} x{item.get('quantity')}" for item in order.get("items", [])])
    
    return f"""🍛 *HEMELEY* - Commande Confirmée!

Bonjour {order.get('customer_name', 'Client')}!

✅ Votre commande #{order.get('id', 'N/A')[:8]} est confirmée.

📦 Articles: {items}
💰 Total: {order.get('total', 0):,} FCFA

📍 Livraison: {order.get('customer_address', 'À confirmer')}

Merci! 🙏"""
