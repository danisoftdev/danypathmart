#!/usr/bin/env python3
"""Generate DanyPathMart legal policy Word documents (separate files, Ghana marketplace)."""

from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Pt, RGBColor
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

OUT_DIR = Path(__file__).resolve().parent
BRAND_GREEN = RGBColor(0x1B, 0x5E, 0x20)
MUTED = RGBColor(0x55, 0x55, 0x55)
PLACEHOLDER = RGBColor(0xB8, 0x6E, 0x00)


def ph(text: str) -> str:
    return f"[{text}]"


def insert_visual(text: str) -> str:
    return f"◆ INSERT: {text} ◆"


def set_cell_shading(cell, fill: str) -> None:
    shading = OxmlElement("w:shd")
    shading.set(qn("w:fill"), fill)
    cell._tc.get_or_add_tcPr().append(shading)


def heading(doc: Document, text: str, level: int = 1) -> None:
    h = doc.add_heading(text, level=level)
    for run in h.runs:
        if level == 1:
            run.font.color.rgb = BRAND_GREEN


def body(doc: Document, text: str) -> None:
    doc.add_paragraph(text)


def bullets(doc: Document, items: list[str]) -> None:
    for item in items:
        doc.add_paragraph(item, style="List Bullet")


def numbered_list(doc: Document, items: list[str]) -> None:
    for item in items:
        doc.add_paragraph(item, style="List Number")


def add_insert_box(doc: Document, label: str, hint: str = "") -> None:
    table = doc.add_table(rows=1, cols=1)
    table.style = "Table Grid"
    cell = table.rows[0].cells[0]
    set_cell_shading(cell, "FFF8E1")
    p = cell.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run(insert_visual(label))
    run.bold = True
    run.font.color.rgb = PLACEHOLDER
    if hint:
        p2 = cell.add_paragraph(hint)
        p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
        for r in p2.runs:
            r.font.size = Pt(9)
            r.font.color.rgb = MUTED
            r.italic = True
    doc.add_paragraph()


def add_policy_header(doc: Document, title: str, slug_hint: str) -> None:
    add_insert_box(doc, "LOGO HERE (optional, top of policy)", "Insert → Pictures")
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run(ph("COMPANY LEGAL NAME"))
    r.bold = True
    r.font.size = Pt(16)
    r.font.color.rgb = PLACEHOLDER
    doc.add_paragraph()
    heading(doc, title)
    meta = doc.add_paragraph()
    meta.add_run("Effective date: ").bold = True
    meta.add_run(ph("EFFECTIVE DATE"))
    meta.add_run("  ·  Last updated: ")
    meta.add_run(ph("LAST UPDATED DATE"))
    meta.add_run("  ·  Website slug for admin CMS: ")
    run = meta.add_run(slug_hint)
    run.italic = True
    doc.add_paragraph()
    warn = doc.add_paragraph(
        "DRAFT — NOT LEGAL ADVICE. Have a qualified Ghana lawyer review before publishing. "
        "Replace all " + ph("BRACKETED") + " placeholders, then paste into Admin → Legal policies "
        "or publish as PDF on your site."
    )
    for r in warn.runs:
        r.italic = True
        r.font.size = Pt(9)
        r.font.color.rgb = MUTED
    doc.add_paragraph()


def add_sections(doc: Document, sections: list[tuple[str, list[str]]]) -> None:
    for title, paragraphs in sections:
        heading(doc, title, level=2)
        for para in paragraphs:
            if para.startswith("• "):
                doc.add_paragraph(para[2:], style="List Bullet")
            elif para.startswith("- "):
                doc.add_paragraph(para[2:], style="List Bullet")
            else:
                body(doc, para)
        doc.add_paragraph()


def company_block() -> list[str]:
    return [
        ph("COMPANY LEGAL NAME") + " (" + ph("TRADING NAME / BRAND NAME") + "), "
        "registered in Ghana" + (" (Company No. " + ph("RGD COMPANY NUMBER") + ")" if True else "")
        + ", with registered office at " + ph("REGISTERED OFFICE ADDRESS")
        + " and contact email " + ph("SUPPORT EMAIL") + ", phone " + ph("SUPPORT PHONE")
        + ", website " + ph("YOUR WEBSITE URL") + " (\"we\", \"us\", \"our\").",
    ]


def build_guide_doc() -> Path:
    doc = Document()
    add_policy_header(doc, "Legal Policies — Where To Fill Your Details", "—")
    heading(doc, "Documents in this folder", level=2)
    rows = [
        ("01_Terms_and_Conditions.docx", "terms", "All customers using the site"),
        ("02_Privacy_Policy.docx", "privacy", "Data collection & DPC compliance"),
        ("03_Cookies_Policy.docx", "cookies", "Cookies & similar technologies"),
        ("04_Shop_Seller_Policy.docx", "shop-policy", "Marketplace sellers / shops"),
        ("05_Payment_Policy.docx", "payments", "Paystack, fees, billing"),
        ("06_Returns_and_Refunds_Policy.docx", "returns", "Returns & refunds (existing slug)"),
        ("07_Acceptable_Use_Policy.docx", "acceptable-use", "Prohibited conduct"),
        ("08_Complaints_and_Disputes.docx", "complaints", "How to complain / disputes"),
    ]
    table = doc.add_table(rows=1 + len(rows), cols=3)
    table.style = "Table Grid"
    for i, h in enumerate(["File", "Suggested CMS slug", "Audience"]):
        table.rows[0].cells[i].text = h
        set_cell_shading(table.rows[0].cells[i], "E8F5E9")
    for ri, row in enumerate(rows):
        for ci, val in enumerate(row):
            table.rows[ri + 1].cells[ci].text = val
    doc.add_paragraph()

    heading(doc, "Placeholders to fill in every document", level=2)
    bullets(
        doc,
        [
            ph("COMPANY LEGAL NAME") + " — exact name on RGD certificate",
            ph("TRADING NAME / BRAND NAME") + " — e.g. DanyPathMart",
            ph("RGD COMPANY NUMBER") + " — from Registrar General",
            ph("TIN") + " — Ghana Revenue Authority tax ID (if shown)",
            ph("REGISTERED OFFICE ADDRESS") + " — physical / registered address",
            ph("SUPPORT EMAIL") + ", " + ph("SUPPORT PHONE") + ", " + ph("WHATSAPP SUPPORT"),
            ph("YOUR WEBSITE URL") + " — e.g. https://danypathmart.store",
            ph("EFFECTIVE DATE") + " / " + ph("LAST UPDATED DATE"),
            ph("STANDARD REGISTRATION FEE") + ", " + ph("RENEWAL FEE AND PERIOD"),
            ph("RETURNS WINDOW DAYS") + " — e.g. 7",
            ph("DATA PROTECTION OFFICER EMAIL") + " — for privacy requests",
            ph("PAYSTACK BUSINESS NAME") + " — as shown on checkout",
            ph("GOVERNING LAW") + " — typically \"Republic of Ghana\"",
        ],
    )

    heading(doc, "Publishing on DanyPathMart", level=2)
    numbered_list(
        doc,
        [
            "Fill placeholders in each Word file; optional lawyer review.",
            "Admin → Legal policies → create or edit each policy using the suggested slug.",
            "Set Published = yes and Show in footer where appropriate.",
            "Terms & Privacy: show in footer. Cookies: footer or link from Privacy.",
            "Shop policy: link from shop apply page and seller dashboard.",
            "Payment policy: link at checkout and shop billing pages.",
        ],
    )
    path = OUT_DIR / "00_DPM_Legal_Where_To_Fill_Your_Details.docx"
    doc.save(path)
    return path


def build_terms() -> Path:
    doc = Document()
    add_policy_header(doc, "Terms and Conditions", "terms")
    add_sections(
        doc,
        [
            ("1. Introduction", company_block() + [
                "These Terms and Conditions (\"Terms\") govern your access to and use of our website, "
                "mobile experiences, and related services (the \"Platform\"). By creating an account, "
                "browsing, or placing an order, you agree to these Terms and our Privacy Policy.",
            ]),
            ("2. Eligibility", [
                "You must be at least 18 years old or have consent from a parent/guardian to use the Platform.",
                "You must provide accurate registration information and keep your account credentials secure.",
                "We may refuse or terminate access if information is false or if you breach these Terms.",
            ]),
            ("3. Our role", [
                ph("TRADING NAME / BRAND NAME") + " operates an online marketplace and retail platform. "
                "Some products are sold directly by us (\"DPM catalog\"). Other products are listed and "
                "fulfilled by independent approved sellers (\"Shops\"). Where a Shop sells to you, "
                "that Shop is the seller of record for the shop item; we provide the Platform, checkout, "
                "and order management unless stated otherwise on the product page.",
            ]),
            ("4. Accounts", [
                "You are responsible for activity under your account.",
                "Notify us immediately at " + ph("SUPPORT EMAIL") + " if you suspect unauthorised access.",
                "We may suspend accounts for fraud, abuse, or legal compliance.",
            ]),
            ("5. Products, pricing & availability", [
                "Prices are displayed in Ghana Cedis (GHS) unless stated otherwise.",
                "We and our Shops strive to display accurate descriptions and prices; errors may be corrected "
                "and orders cancelled with a refund where payment was taken.",
                "Product availability is not guaranteed until checkout is complete.",
            ]),
            ("6. Orders & contract", [
                "Placing an order is an offer to purchase. Acceptance occurs when we or the relevant Shop "
                "confirms the order (e.g. confirmation email or status update).",
                "Mixed carts may contain DPM and Shop items with different fulfillment rules as shown at checkout.",
            ]),
            ("7. Delivery & pickup", [
                "Delivery options, fees, and timelines are shown at checkout and may vary by item type and location.",
                "Risk of loss passes according to the delivery method and our delivery policy as stated at checkout.",
                "You must provide a correct delivery address or valid pickup details.",
            ]),
            ("8. Seller terms", [
                "If you register as a Shop seller, you also agree to our Shop / Seller Policy "
                "(available at " + ph("YOUR WEBSITE URL") + "/policies/shop-policy).",
            ]),
            ("9. Intellectual property", [
                "Platform content, branding, and software are owned by us or our licensors.",
                "You may not copy, scrape, or reverse-engineer the Platform except as permitted by law.",
            ]),
            ("10. Prohibited use", [
                "You must comply with our Acceptable Use Policy. Unlawful, fraudulent, or abusive use is prohibited.",
            ]),
            ("11. Limitation of liability", [
                "To the fullest extent permitted by Ghana law, we are not liable for indirect or consequential loss.",
                "Our total liability for any claim relating to the Platform is limited to the amount you paid "
                "for the relevant order in the preceding 12 months, except where liability cannot be limited by law.",
                "Nothing in these Terms excludes liability for death, personal injury caused by negligence, or fraud.",
            ]),
            ("12. Changes", [
                "We may update these Terms. Material changes will be posted on the Platform with an updated "
                + ph("LAST UPDATED DATE") + ". Continued use after changes constitutes acceptance.",
            ]),
            ("13. Governing law & disputes", [
                "These Terms are governed by the laws of the " + ph("GOVERNING LAW") + ".",
                "Disputes should first be raised via our Complaints & Disputes process at "
                + ph("YOUR WEBSITE URL") + "/policies/complaints.",
                "Courts in " + ph("PREFERRED COURTS / JURISDICTION") + " have non-exclusive jurisdiction unless mandatory law provides otherwise.",
            ]),
            ("14. Contact", [
                ph("COMPANY LEGAL NAME") + " · " + ph("REGISTERED OFFICE ADDRESS"),
                "Email: " + ph("SUPPORT EMAIL") + " · Phone: " + ph("SUPPORT PHONE"),
            ]),
        ],
    )
    path = OUT_DIR / "01_Terms_and_Conditions.docx"
    doc.save(path)
    return path


def build_privacy() -> Path:
    doc = Document()
    add_policy_header(doc, "Privacy Policy", "privacy")
    add_sections(
        doc,
        [
            ("1. Who we are", company_block() + [
                "This Privacy Policy explains how we collect, use, store, and share personal data when you "
                "use our Platform, in accordance with the Ghana Data Protection Act, 2012 (Act 843) and "
                "applicable regulations.",
            ]),
            ("2. Data controller", [
                "The data controller is " + ph("COMPANY LEGAL NAME") + ". "
                "Data protection contact: " + ph("DATA PROTECTION OFFICER EMAIL") + ".",
                "If required, we are registered with the Data Protection Commission (DPC), Ghana — "
                "Registration reference: " + ph("DPC REGISTRATION REFERENCE (if applicable)") + ".",
            ]),
            ("3. Personal data we collect", [
                "• Identity & contact: name, email, phone, delivery address",
                "• Account: username, password (hashed), preferences, verification status",
                "• Order & payment: order history, amounts, transaction references (payment card/MoMo details "
                "are processed by Paystack — we do not store full card numbers)",
                "• Shop sellers: business name, payout details (bank/MoMo), application documents if provided",
                "• Communications: support chat, emails, complaints",
                "• Technical: IP address, device/browser type, cookies (see Cookies Policy)",
                "• Optional: profile photo, social login identifiers if you use OAuth",
            ]),
            ("4. How we use data", [
                "• Provide the Platform, process orders, and deliver products",
                "• Verify identity, prevent fraud, and secure accounts",
                "• Customer support and dispute resolution",
                "• Shop onboarding, billing, and payouts",
                "• Legal, tax, and regulatory compliance",
                "• Improve the Platform and send service messages (order updates)",
                "• Marketing only where you have opted in — you may opt out anytime",
            ]),
            ("5. Legal bases", [
                "We process data based on: performance of a contract; legitimate interests (security, improvement); "
                "legal obligation; and consent where required (e.g. marketing cookies).",
            ]),
            ("6. Sharing data", [
                "We may share data with:",
                "• Payment processor: Paystack (" + ph("PAYSTACK BUSINESS NAME") + ") for payments",
                "• Delivery/logistics partners to fulfil orders",
                "• Shop sellers — only information needed to fulfil shop orders (e.g. name, phone, address for delivery)",
                "• Hosting, email, and analytics providers under contract",
                "• Regulators, courts, or law enforcement when required by law",
                "We do not sell your personal data.",
            ]),
            ("7. International transfers", [
                "Some providers may process data outside Ghana. Where this occurs, we use appropriate "
                "safeguards as required by law.",
            ]),
            ("8. Retention", [
                "We keep personal data only as long as needed for the purposes above, including legal/tax "
                "retention periods (typically " + ph("DATA RETENTION PERIOD") + " for order records unless "
                "longer retention is required by law).",
            ]),
            ("9. Security", [
                "We use HTTPS, access controls, staff permissions, and other measures appropriate to the "
                "risk. No system is 100% secure — report concerns to " + ph("DATA PROTECTION OFFICER EMAIL") + ".",
            ]),
            ("10. Your rights", [
                "Subject to Act 843, you may request access, correction, deletion, or restriction of processing, "
                "and object to certain processing. Contact " + ph("DATA PROTECTION OFFICER EMAIL") + ". "
                "You may lodge a complaint with the Data Protection Commission, Ghana.",
            ]),
            ("11. Children", [
                "The Platform is not directed at children under 13 without parental consent. "
                "Contact us to remove a child's data if collected in error.",
            ]),
            ("12. Changes", [
                "We may update this policy. Check " + ph("LAST UPDATED DATE") + " at the top. "
                "Material changes will be notified on the Platform.",
            ]),
            ("13. Contact", [
                ph("DATA PROTECTION OFFICER EMAIL") + " · " + ph("SUPPORT EMAIL") + " · " + ph("SUPPORT PHONE"),
            ]),
        ],
    )
    path = OUT_DIR / "02_Privacy_Policy.docx"
    doc.save(path)
    return path


def build_cookies() -> Path:
    doc = Document()
    add_policy_header(doc, "Cookies Policy", "cookies")
    add_sections(
        doc,
        [
            ("1. Introduction", company_block() + [
                "This Cookies Policy explains how we use cookies and similar technologies on "
                + ph("YOUR WEBSITE URL") + ". It should be read with our Privacy Policy.",
            ]),
            ("2. What are cookies?", [
                "Cookies are small text files stored on your device. Similar technologies include local storage, "
                "session tokens, and pixels.",
            ]),
            ("3. Types we use", [
                "• Strictly necessary — required for login, cart, checkout, security (cannot be switched off)",
                "• Functional — remember preferences (e.g. currency, theme)",
                "• Analytics — understand usage (e.g. " + ph("ANALYTICS TOOL e.g. Google Analytics if enabled") + ")",
                "• Marketing — only if you enable them (" + ph("MARKETING TOOLS or N/A") + ")",
            ]),
            ("4. Third-party cookies", [
                "Paystack may set cookies during payment. Social login providers may set cookies if you use them. "
                "See their privacy policies for details.",
            ]),
            ("5. Managing cookies", [
                "Use our cookie banner/preferences (if shown) or your browser settings to block or delete cookies. "
                "Blocking necessary cookies may prevent checkout or login.",
            ]),
            ("6. Changes & contact", [
                "Updated " + ph("LAST UPDATED DATE") + ". Questions: " + ph("SUPPORT EMAIL") + ".",
            ]),
        ],
    )
    path = OUT_DIR / "03_Cookies_Policy.docx"
    doc.save(path)
    return path


def build_shop_policy() -> Path:
    doc = Document()
    add_policy_header(doc, "Shop / Seller Policy", "shop-policy")
    add_sections(
        doc,
        [
            ("1. Introduction", company_block() + [
                "This Shop / Seller Policy (\"Seller Policy\") applies to businesses and individuals approved "
                "to sell on our marketplace (\"Shops\", \"Sellers\", \"you\"). By applying or operating a Shop, "
                "you agree to this policy, our Terms and Conditions, Payment Policy, and Acceptable Use Policy.",
            ]),
            ("2. Application & approval", [
                "• Submit accurate application information including business name, contact, city, and payout details",
                "• Pay registration fees where enabled (" + ph("STANDARD REGISTRATION FEE") + ", subject to promotions)",
                "• We may request identity or business documents (e.g. Ghana Card, RGD certificate) for verification",
                "• Approval is at our sole discretion; we may reject or suspend without refund of fees where you breach this policy",
            ]),
            ("3. Listing rules", [
                "• List only products you are authorised to sell; no counterfeit or illegal goods",
                "• Accurate titles, descriptions, prices (GHS), images, and stock status",
                "• Comply with product-specific laws (labelling, safety, IP)",
                "• All listings may be reviewed before going live",
            ]),
            ("4. Orders & fulfillment", [
                "• Shop items: you are responsible for packing and delivery unless otherwise agreed",
                "• Meet stated handling times; update order status promptly in the seller dashboard",
                "• Provide tracking or proof of delivery where applicable",
                "• Mixed orders: DPM catalog items follow DPM fulfillment rules shown at checkout",
            ]),
            ("5. Fees & billing", [
                "Registration: " + ph("STANDARD REGISTRATION FEE") + " (promotions may apply)",
                "Renewal: " + ph("RENEWAL FEE AND PERIOD"),
                "Commission on shop sales: " + ph("SHOP COMMISSION RATE OR DESCRIPTION") + " as shown in your dashboard",
                "See Payment Policy for Paystack, refunds, and chargebacks",
            ]),
            ("6. Payouts", [
                "• Earnings are released according to platform rules (" + ph("PAYOUT RELEASE RULE e.g. on payment confirmed") + ")",
                "• Payouts to your registered bank or MoMo after any hold period (" + ph("PAYOUT SCHEDULE") + ")",
                "• You are responsible for taxes on your shop income (GRA obligations)",
                "• We may offset chargebacks, refunds, or fees from payouts",
            ]),
            ("7. Referrals & promoters", [
                "Referral codes must be used honestly. False or spam referrals may result in suspension. "
                "Promoter commissions are governed by separate promoter terms.",
            ]),
            ("8. Customer service", [
                "Respond to customer inquiries about your products within " + ph("SELLER RESPONSE TIME") + ". "
                "Escalations may be handled by platform support.",
            ]),
            ("9. Suspension & termination", [
                "We may suspend or remove Shops for breach, fraud, poor performance, or legal risk. "
                "Outstanding payouts may be withheld pending investigation.",
            ]),
            ("10. Contact", [
                "Seller support: " + ph("SELLER SUPPORT EMAIL") + " · " + ph("SUPPORT PHONE"),
            ]),
        ],
    )
    path = OUT_DIR / "04_Shop_Seller_Policy.docx"
    doc.save(path)
    return path


def build_payment_policy() -> Path:
    doc = Document()
    add_policy_header(doc, "Payment Policy", "payments")
    add_sections(
        doc,
        [
            ("1. Introduction", company_block() + [
                "This Payment Policy describes how payments work on the Platform for customers and Sellers.",
            ]),
            ("2. Currency", [
                "All prices and charges are in Ghana Cedis (GHS) unless clearly stated otherwise.",
            ]),
            ("3. Payment methods", [
                "We accept payments via Paystack, which supports major cards and mobile money where available. "
                "The payment interface displays as " + ph("PAYSTACK BUSINESS NAME") + ".",
                "We do not store full card or MoMo PIN details on our servers.",
            ]),
            ("4. Customer checkout", [
                "• Payment is required at checkout for prepay orders unless a pay-on-delivery option is explicitly offered",
                "• You authorise Paystack to charge the total shown including product, shipping, and fees",
                "• Failed payments do not create a binding order",
                "• Receipts and references are sent by email where configured",
            ]),
            ("5. Shop registration & renewal fees", [
                "Sellers may pay registration and renewal fees via Paystack as shown on the apply page and dashboard. "
                "Fees are non-refundable except where required by law or explicitly stated in a promotion.",
                "Promotional pricing (free periods, discounts, referral codes) is applied as shown at checkout.",
            ]),
            ("6. Refunds to customers", [
                "Approved refunds are processed to the original payment method via Paystack where possible. "
                "Processing time: typically " + ph("REFUND PROCESSING DAYS") + " business days after approval.",
                "See Returns & Refunds Policy for eligibility.",
            ]),
            ("7. Seller payouts", [
                "Shop earnings are credited per platform rules and paid to registered payout details. "
                "Minimum payout threshold: " + ph("MINIMUM PAYOUT AMOUNT") + ".",
                "We are not a bank; payout delays may occur for verification, disputes, or public holidays.",
            ]),
            ("8. Chargebacks & disputes", [
                "Paystack or card issuers may reverse payments (chargebacks). We may deduct related amounts from Seller payouts.",
                "Report payment issues to " + ph("SUPPORT EMAIL") + " with order reference.",
            ]),
            ("9. Taxes", [
                "Prices may be subject to applicable taxes (e.g. VAT, NHIL, GETFund) as required by Ghana law. "
                "Tax treatment is " + ph("TAX TREATMENT STATEMENT e.g. inclusive/exclusive as shown at checkout") + ".",
            ]),
            ("10. Contact", [
                ph("SUPPORT EMAIL") + " · " + ph("SUPPORT PHONE"),
            ]),
        ],
    )
    path = OUT_DIR / "05_Payment_Policy.docx"
    doc.save(path)
    return path


def build_returns() -> Path:
    doc = Document()
    add_policy_header(doc, "Returns & Refunds Policy", "returns")
    add_sections(
        doc,
        [
            ("1. Introduction", company_block() + [
                "This policy explains when you may return products and how refunds work. "
                "Rules may differ for DPM catalog items and Shop items as noted below.",
            ]),
            ("2. DPM catalog items", [
                "• Returns accepted within " + ph("RETURNS WINDOW DAYS") + " days of delivery for unused items in original packaging",
                "• Contact " + ph("SUPPORT EMAIL") + " before returning — we will provide instructions",
                "• Refunds after inspection to original payment method via Paystack",
                "• Shipping costs on returns: " + ph("RETURN SHIPPING RULE e.g. customer pays unless faulty") + "",
            ]),
            ("3. Shop (marketplace) items", [
                "The Shop is the seller of record. Return eligibility follows the Shop listing and this policy minimum standard.",
                "Contact us or the Shop via your order page. We may mediate disputes under our Complaints process.",
            ]),
            ("4. Non-returnable items", [
                "• Personalised or custom-made items unless defective",
                "• Perishable goods, hygiene products once opened (if applicable)",
                "• Digital goods after download/access (if applicable)",
                "• Items marked non-returnable on the product page",
            ]),
            ("5. Faulty or wrong items", [
                "If an item is defective or not as described, contact us within " + ph("DEFECT REPORT DAYS") + " days "
                "with photos. We will arrange replacement, repair, or refund as appropriate.",
            ]),
            ("6. Cancellations", [
                "Orders may be cancelled before dispatch — contact support immediately. "
                "Pre-order cancellation rules: " + ph("PREORDER CANCELLATION RULES") + ".",
            ]),
            ("7. Refund timing", [
                "Approved refunds processed within " + ph("REFUND PROCESSING DAYS") + " business days; "
                "bank/MoMo posting may take additional time.",
            ]),
            ("8. Contact", [
                ph("SUPPORT EMAIL") + " · " + ph("SUPPORT PHONE") + " · WhatsApp: " + ph("WHATSAPP SUPPORT"),
            ]),
        ],
    )
    path = OUT_DIR / "06_Returns_and_Refunds_Policy.docx"
    doc.save(path)
    return path


def build_acceptable_use() -> Path:
    doc = Document()
    add_policy_header(doc, "Acceptable Use Policy", "acceptable-use")
    add_sections(
        doc,
        [
            ("1. Purpose", [
                "This policy sets rules for using " + ph("YOUR WEBSITE URL") + " lawfully and respectfully.",
            ]),
            ("2. You must not", [
                "• Break any law in Ghana or your jurisdiction",
                "• Sell or list counterfeit, stolen, dangerous, or prohibited goods",
                "• Infringe intellectual property (fake brands, pirated content)",
                "• Harass, threaten, or discriminate against users or staff",
                "• Attempt to hack, scrape, overload, or bypass security",
                "• Create fake accounts, reviews, or orders",
                "• Use the Platform for money laundering or fraud",
                "• Send spam or unauthorised marketing via our systems",
                "• Misrepresent affiliation with " + ph("TRADING NAME / BRAND NAME") + " or any third party",
            ]),
            ("3. Enforcement", [
                "We may remove content, suspend accounts, withhold payouts, and report illegal activity to authorities.",
            ]),
            ("4. Reporting", [
                "Report violations to " + ph("SUPPORT EMAIL") + " with evidence (URLs, screenshots, order IDs).",
            ]),
        ],
    )
    path = OUT_DIR / "07_Acceptable_Use_Policy.docx"
    doc.save(path)
    return path


def build_complaints() -> Path:
    doc = Document()
    add_policy_header(doc, "Complaints & Disputes Policy", "complaints")
    add_sections(
        doc,
        [
            ("1. Our commitment", [
                ph("TRADING NAME / BRAND NAME") + " aims to resolve complaints fairly and promptly.",
            ]),
            ("2. How to complain", [
                "Email: " + ph("SUPPORT EMAIL"),
                "Phone / WhatsApp: " + ph("SUPPORT PHONE") + " / " + ph("WHATSAPP SUPPORT"),
                "Live chat on " + ph("YOUR WEBSITE URL") + " (when available)",
                "Include: your name, order number, date, and clear description of the issue.",
            ]),
            ("3. Response times", [
                "We acknowledge complaints within " + ph("COMPLAINT ACKNOWLEDGEMENT TIME e.g. 2 business days") + ".",
                "We aim to resolve within " + ph("COMPLAINT RESOLUTION TARGET e.g. 14 business days") + ".",
                "Complex cases (delivery loss, Shop disputes) may take longer — we will keep you updated.",
            ]),
            ("4. Shop order disputes", [
                "For marketplace items, we may contact the Shop and mediate. Outcomes may include refund, "
                "replacement, or partial credit as appropriate.",
            ]),
            ("5. Escalation", [
                "If unsatisfied with our response, request escalation to " + ph("ESCALATION CONTACT NAME / ROLE") + " at "
                + ph("ESCALATION EMAIL") + ".",
                "You may also refer matters to relevant consumer protection authorities in Ghana where applicable.",
            ]),
            ("6. Chargebacks", [
                "Contact us before initiating a bank chargeback — we can often resolve faster. "
                "See Payment Policy.",
            ]),
        ],
    )
    path = OUT_DIR / "08_Complaints_and_Disputes.docx"
    doc.save(path)
    return path


def main() -> None:
    paths = [
        build_guide_doc(),
        build_terms(),
        build_privacy(),
        build_cookies(),
        build_shop_policy(),
        build_payment_policy(),
        build_returns(),
        build_acceptable_use(),
        build_complaints(),
    ]
    print("Generated legal policy documents:")
    for p in paths:
        print(f"  {p}")


if __name__ == "__main__":
    main()
