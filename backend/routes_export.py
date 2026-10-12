from fastapi import APIRouter, HTTPException, Depends, Request, Response
from auth import require_role
from datetime import datetime, timezone
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image as RLImage
from reportlab.lib.units import inch
from io import BytesIO
import logging

logger = logging.getLogger(__name__)

export_router = APIRouter()

def get_db(request: Request):
    return request.app.state.db

@export_router.get("/vendor/orders-report")
async def export_vendor_orders(
    format: str = "pdf",
    user: dict = Depends(require_role("vendor")),
    db = Depends(get_db)
):
    """
    Export vendor orders report as PDF
    """
    try:
        # Get vendor orders
        orders = await db.orders.find(
            {"vendor_id": user["id"]},
            {"_id": 0}
        ).sort("created_at", -1).limit(100).to_list(100)
        
        # Get vendor stats
        total_orders = len(orders)
        total_revenue = sum(order.get("total", 0) for order in orders if order.get("payment_status") == "success")
        pending_orders = len([o for o in orders if o.get("order_status") == "pending"])
        
        # Create PDF
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4)
        elements = []
        
        # Styles
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#FF6B00'),
            spaceAfter=30,
            alignment=1  # Center
        )
        
        heading_style = ParagraphStyle(
            'CustomHeading',
            parent=styles['Heading2'],
            fontSize=16,
            textColor=colors.HexColor('#2D241E'),
            spaceAfter=12
        )
        
        # Title
        title = Paragraph("HEMELEY - Rapport Vendeur", title_style)
        elements.append(title)
        elements.append(Spacer(1, 12))
        
        # Vendor info
        vendor_info = Paragraph(f"<b>Vendeur:</b> {user['name']}<br/><b>Zone:</b> {user['zone']}<br/><b>Date:</b> {datetime.now().strftime('%d/%m/%Y %H:%M')}", styles['Normal'])
        elements.append(vendor_info)
        elements.append(Spacer(1, 20))
        
        # Statistics
        stats_heading = Paragraph("Statistiques", heading_style)
        elements.append(stats_heading)
        
        stats_data = [
            ['Total Commandes', str(total_orders)],
            ['Revenus Totaux', f'{total_revenue:,.0f} FCFA'],
            ['Commandes en attente', str(pending_orders)]
        ]
        
        stats_table = Table(stats_data, colWidths=[3*inch, 2*inch])
        stats_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#FFF8F0')),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#2D241E')),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 12),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ('TOPPADDING', (0, 0), (-1, -1), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#FF6B00'))
        ]))
        elements.append(stats_table)
        elements.append(Spacer(1, 30))
        
        # Orders table
        orders_heading = Paragraph("Dernières Commandes", heading_style)
        elements.append(orders_heading)
        
        if orders:
            # Table headers
            orders_data = [['N° Commande', 'Client', 'Montant', 'Statut', 'Date']]
            
            # Table rows
            for order in orders[:50]:  # Limit to 50 orders
                created_at = order.get('created_at', '')
                if isinstance(created_at, str):
                    try:
                        created_at = datetime.fromisoformat(created_at).strftime('%d/%m/%Y')
                    except:
                        created_at = 'N/A'
                
                status_map = {
                    'pending': 'En attente',
                    'confirmed': 'Confirmée',
                    'preparing': 'En préparation',
                    'ready': 'Prêt',
                    'in_delivery': 'En livraison',
                    'delivered': 'Livrée',
                    'cancelled': 'Annulée'
                }
                
                orders_data.append([
                    order.get('order_number', 'N/A'),
                    order.get('customer_name', 'N/A'),
                    f"{order.get('total', 0):,.0f} FCFA",
                    status_map.get(order.get('order_status', 'pending'), 'N/A'),
                    created_at
                ])
            
            orders_table = Table(orders_data, colWidths=[1.5*inch, 1.5*inch, 1.2*inch, 1.2*inch, 1*inch])
            orders_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#FF6B00')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('FONTSIZE', (0, 1), (-1, -1), 9),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#FFF8F0')])
            ]))
            elements.append(orders_table)
        else:
            no_orders = Paragraph("Aucune commande pour le moment.", styles['Normal'])
            elements.append(no_orders)
        
        # Footer
        elements.append(Spacer(1, 30))
        footer = Paragraph(
            "<i>Document généré par HEMELEY - Le goût du risque 🍛</i>",
            ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8, textColor=colors.grey, alignment=1)
        )
        elements.append(footer)
        
        # Build PDF
        doc.build(elements)
        
        # Get PDF bytes
        pdf_bytes = buffer.getvalue()
        buffer.close()
        
        # Return PDF
        filename = f"hemeley_rapport_{user['name'].replace(' ', '_')}_{datetime.now().strftime('%Y%m%d')}.pdf"
        
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
        
    except Exception as e:
        logger.error(f"Error generating PDF: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erreur lors de la génération du PDF: {str(e)}")

@export_router.get("/admin/global-report")
async def export_admin_report(
    user: dict = Depends(require_role("admin", "super_admin")),
    db = Depends(get_db)
):
    """
    Export global platform report as PDF (Admin only)
    """
    try:
        # Get global stats
        total_vendors = await db.vendors.count_documents({"is_active": True})
        total_delivery = await db.delivery_partners.count_documents({"is_active": True})
        total_orders = await db.orders.count_documents({})
        
        # Get revenue
        pipeline = [
            {"$match": {"payment_status": "success"}},
            {"$group": {"_id": None, "total": {"$sum": "$total"}}}
        ]
        result = await db.orders.aggregate(pipeline).to_list(1)
        total_revenue = result[0]["total"] if result else 0
        
        # Create PDF
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4)
        elements = []
        
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#FF6B00'),
            spaceAfter=30,
            alignment=1
        )
        
        # Title
        title = Paragraph("HEMELEY - Rapport Global Plateforme", title_style)
        elements.append(title)
        elements.append(Spacer(1, 20))
        
        # Date
        date_info = Paragraph(f"<b>Date:</b> {datetime.now().strftime('%d/%m/%Y %H:%M')}", styles['Normal'])
        elements.append(date_info)
        elements.append(Spacer(1, 30))
        
        # Global stats
        stats_data = [
            ['Vendeurs actifs', str(total_vendors)],
            ['Livreurs actifs', str(total_delivery)],
            ['Total commandes', str(total_orders)],
            ['Revenus totaux', f'{total_revenue:,.0f} FCFA']
        ]
        
        stats_table = Table(stats_data, colWidths=[3*inch, 2.5*inch])
        stats_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#FFF8F0')),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#2D241E')),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 14),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 15),
            ('TOPPADDING', (0, 0), (-1, -1), 15),
            ('GRID', (0, 0), (-1, -1), 2, colors.HexColor('#FF6B00'))
        ]))
        elements.append(stats_table)
        
        # Footer
        elements.append(Spacer(1, 40))
        footer = Paragraph(
            "<i>Rapport administrateur HEMELEY</i>",
            ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8, textColor=colors.grey, alignment=1)
        )
        elements.append(footer)
        
        # Build PDF
        doc.build(elements)
        
        pdf_bytes = buffer.getvalue()
        buffer.close()
        
        filename = f"hemeley_rapport_global_{datetime.now().strftime('%Y%m%d')}.pdf"
        
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
        
    except Exception as e:
        logger.error(f"Error generating admin PDF: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erreur lors de la génération du PDF: {str(e)}")
