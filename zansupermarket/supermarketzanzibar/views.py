import logging
from io import BytesIO
from urllib.parse import quote
from decimal import Decimal
from django.contrib.auth import authenticate, get_user_model
from django.core.mail import send_mail
from django.core.exceptions import SuspiciousOperation
from django.db import DatabaseError, transaction
from django.http import HttpResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Image as ReportLabImage, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from rest_framework import permissions, status, viewsets, exceptions
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from .models import Category, Customer, Payment, Product, Sale, SaleItem, StockMovement, Supplier
from .serializers import (
    AdminCreateUserSerializer,
    AdminRegisterSerializer,
    CategorySerializer,
    CheckoutSerializer,
    CustomerSerializer,
    PaymentSerializer,
    PaymentAdminSerializer,
    ProductSerializer,
    PublicProductSerializer,
    RegisterSerializer,
    SaleItemSerializer,
    SaleSerializer,
    StockSerializer,
    SupplierSerializer,
    UserSerializer,
)

User = get_user_model()
logger = logging.getLogger(__name__)
PRODUCT_SERIALIZATION_ERRORS = (AttributeError, TypeError, ValueError, SuspiciousOperation)
WHATSAPP_ORDER_NUMBER = "255711252758"
STORE_NAME = "Zansupermarket"
STORE_SUBTITLE = "Fresh groceries, snacks, and daily essentials in Zanzibar."
STORE_PHONE = "+255 700 000 000"
STORE_EMAIL = "support@zansupermarket.com"
STORE_LOCATION = "Stone Town, Zanzibar"
RECEIPT_ABOUT_CARDS = [
    (
        "Fresh supply",
        "We connect Zanzibar shoppers with trusted suppliers for groceries, snacks, and daily essentials.",
    ),
    (
        "Fast discovery",
        "Search products instantly, filter by category, and open any item quickly without losing your place.",
    ),
    (
        "Simple shopping",
        "Browse, add to cart, and move into checkout from the same catalog flow with less friction.",
    ),
]


def build_whatsapp_order_url(sale, payment, sale_items):
    lines = [
        "Zanzibar Supermarket Order",
        f"Order ID: {sale.id}",
        f"Control Number: {payment.control_number}",
        f"Customer: {sale.customer_name_display or 'Customer'}",
        f"Email: {sale.customer_email_display or 'Not provided'}",
        f"Phone: {sale.customer_phone_display or 'Not provided'}",
        f"Address: {sale.customer_address_display or 'Not provided'}",
        f"Delivery Location: {sale.delivery_location or 'Not provided'}",
        f"Payment Method: {sale.payment_method}",
        f"Payment Status: {payment.status}",
        f"Total: TZS {sale.final_amount}",
        "Items:",
    ]

    for product, quantity in sale_items:
        lines.append(f"- {product.name} x{quantity} @ TZS {product.price} = TZS {product.price * quantity}")

    message = "\n".join(lines)
    return f"https://wa.me/{WHATSAPP_ORDER_NUMBER}?text={quote(message)}"


def _receipt_styles():
    base_styles = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "ReceiptTitle",
            parent=base_styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=22,
            leading=26,
            textColor=colors.whitesmoke,
            spaceAfter=4,
        ),
        "header_text": ParagraphStyle(
            "ReceiptHeaderText",
            parent=base_styles["BodyText"],
            fontName="Helvetica",
            fontSize=10,
            leading=13,
            textColor=colors.whitesmoke,
        ),
        "header_status": ParagraphStyle(
            "ReceiptHeaderStatus",
            parent=base_styles["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=15,
            leading=18,
            alignment=2,
            textColor=colors.whitesmoke,
        ),
        "section_title": ParagraphStyle(
            "ReceiptSectionTitle",
            parent=base_styles["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=12,
            textColor=colors.HexColor("#15722d"),
            textTransform="uppercase",
        ),
        "label": ParagraphStyle(
            "ReceiptLabel",
            parent=base_styles["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=11,
            textColor=colors.HexColor("#668070"),
        ),
        "value": ParagraphStyle(
            "ReceiptValue",
            parent=base_styles["BodyText"],
            fontName="Helvetica",
            fontSize=9.4,
            leading=12,
            textColor=colors.HexColor("#213128"),
        ),
        "value_bold": ParagraphStyle(
            "ReceiptValueBold",
            parent=base_styles["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=12,
            textColor=colors.HexColor("#213128"),
        ),
        "total": ParagraphStyle(
            "ReceiptTotal",
            parent=base_styles["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=14,
            leading=17,
            textColor=colors.HexColor("#15722d"),
            alignment=2,
        ),
        "small": ParagraphStyle(
            "ReceiptSmall",
            parent=base_styles["BodyText"],
            fontName="Helvetica",
            fontSize=8.5,
            leading=11,
            textColor=colors.HexColor("#668070"),
        ),
        "info_title": ParagraphStyle(
            "ReceiptInfoTitle",
            parent=base_styles["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=12,
            textColor=colors.HexColor("#213128"),
        ),
        "info_text": ParagraphStyle(
            "ReceiptInfoText",
            parent=base_styles["BodyText"],
            fontName="Helvetica",
            fontSize=8.8,
            leading=12,
            textColor=colors.HexColor("#668070"),
        ),
    }


def _receipt_section_header(title, width, styles):
    header = Table(
        [[Paragraph(title, styles["section_title"])]],
        colWidths=[width],
    )
    header.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#dcefdc")),
                ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#c4ddc4")),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    return header


def _receipt_product_image(file_field, width, height):
    try:
        if not file_field:
            return None
        if hasattr(file_field, "storage") and hasattr(file_field, "name") and not file_field.storage.exists(file_field.name):
            return None
        with file_field.storage.open(file_field.name, "rb") as image_file:
            image = ReportLabImage(BytesIO(image_file.read()), width=width, height=height)
            image.hAlign = "LEFT"
            return image
    except (AttributeError, OSError, TypeError, ValueError, SuspiciousOperation):
        return None


def build_receipt_pdf(sale):
    payment = sale.payment
    styles = _receipt_styles()
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=14 * mm,
        rightMargin=14 * mm,
        topMargin=14 * mm,
        bottomMargin=14 * mm,
        pageCompression=0,
    )
    page_width = A4[0] - doc.leftMargin - doc.rightMargin
    story = []

    header_table = Table(
        [
            [
                Paragraph(
                    (
                        f"<font size='22'><b>{STORE_NAME}</b></font><br/>"
                        f"<font size='10'>{STORE_SUBTITLE}</font><br/>"
                        "<font size='10'>Official Customer Receipt</font>"
                    ),
                    styles["title"],
                ),
                Paragraph(
                    f"Payment Confirmed<br/>Control #{payment.control_number}<br/>Order #{sale.id}<br/>{sale.created_at:%Y-%m-%d %H:%M}",
                    styles["header_status"],
                ),
            ]
        ],
        colWidths=[page_width * 0.62, page_width * 0.38],
    )
    header_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#1f8f3a")),
                ("TEXTCOLOR", (0, 0), (-1, -1), colors.whitesmoke),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 14),
                ("RIGHTPADDING", (0, 0), (-1, -1), 14),
                ("TOPPADDING", (0, 0), (-1, -1), 14),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
                ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#15722d")),
            ]
        )
    )
    story.extend([header_table, Spacer(1, 10)])

    detail_rows = [
        [
            Paragraph("Customer", styles["label"]),
            Paragraph(sale.customer_name_display or "Customer", styles["value"]),
            Paragraph("Email", styles["label"]),
            Paragraph(sale.customer_email_display or "Not provided", styles["value"]),
        ],
        [
            Paragraph("Phone", styles["label"]),
            Paragraph(sale.customer_phone_display or "Not provided", styles["value"]),
            Paragraph("Address", styles["label"]),
            Paragraph(sale.customer_address_display or "Not provided", styles["value"]),
        ],
        [
            Paragraph("Delivery", styles["label"]),
            Paragraph(sale.delivery_location or "Not provided", styles["value"]),
            Paragraph("Payment Method", styles["label"]),
            Paragraph(sale.payment_method, styles["value"]),
        ],
    ]
    details_table = Table(
        detail_rows,
        colWidths=[22 * mm, 56 * mm, 24 * mm, page_width - (22 + 56 + 24) * mm],
    )
    details_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.whitesmoke),
                ("GRID", (0, 0), (-1, -1), 0.6, colors.HexColor("#dbe6db")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    story.extend(
        [
            _receipt_section_header("Customer & Order Details", page_width, styles),
            Spacer(1, 6),
            details_table,
            Spacer(1, 10),
        ]
    )

    product_cards = []
    for item in sale.items.all():
        image_cell = _receipt_product_image(getattr(item.product, "image", None), 22 * mm, 22 * mm)
        if image_cell is None:
            image_cell = Paragraph("Product image unavailable", styles["small"])
        copy = Paragraph(
            (
                f"<b>{item.product.name}</b><br/>"
                f"Quantity: {item.quantity}<br/>"
                f"Unit Price: TZS {item.price}<br/>"
                f"Paid Total: TZS {item.total}"
            ),
            styles["value"],
        )
        total = Paragraph(f"TZS {item.total}", styles["total"])
        item_table = Table(
            [[image_cell, copy, total]],
            colWidths=[28 * mm, page_width - 28 * mm - 35 * mm, 35 * mm],
        )
        item_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fbf8")),
                    ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#dbe6db")),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                    ("TOPPADDING", (0, 0), (-1, -1), 8),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        product_cards.extend([item_table, Spacer(1, 6)])

    totals_table = Table(
        [
            [Paragraph("Subtotal", styles["label"]), Paragraph(f"TZS {sale.total_amount}", styles["value_bold"])],
            [Paragraph("Discount", styles["label"]), Paragraph(f"TZS {sale.discount}", styles["value_bold"])],
            [Paragraph("Tax", styles["label"]), Paragraph(f"TZS {sale.tax}", styles["value_bold"])],
            [Paragraph("Final Amount", styles["label"]), Paragraph(f"TZS {sale.final_amount}", styles["total"])],
        ],
        colWidths=[42 * mm, 45 * mm],
        hAlign="RIGHT",
    )
    totals_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.whitesmoke),
                ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#dbe6db")),
                ("GRID", (0, 0), (-1, -1), 0.6, colors.HexColor("#dbe6db")),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    story.extend(
        [
            _receipt_section_header("Paid Products", page_width, styles),
            Spacer(1, 6),
            *product_cards,
            Spacer(1, 4),
            totals_table,
            Spacer(1, 10),
        ]
    )

    about_cards = []
    for title, description in RECEIPT_ABOUT_CARDS:
        about_cards.append(
            Paragraph(f"<b>{title}</b><br/>{description}", styles["info_text"])
        )
    about_table = Table([about_cards], colWidths=[page_width / 3.0] * 3)
    about_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fbf8")),
                ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#dbe6db")),
                ("INNERGRID", (0, 0), (-1, -1), 0.6, colors.HexColor("#dbe6db")),
                ("LEFTPADDING", (0, 0), (-1, -1), 9),
                ("RIGHTPADDING", (0, 0), (-1, -1), 9),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    story.extend(
        [
            _receipt_section_header("About Us", page_width, styles),
            Spacer(1, 6),
            about_table,
            Spacer(1, 10),
        ]
    )

    contact_table = Table(
        [
            [
                Paragraph(f"<b>Phone</b><br/>{STORE_PHONE}", styles["info_text"]),
                Paragraph(f"<b>Email</b><br/>{STORE_EMAIL}", styles["info_text"]),
                Paragraph(f"<b>Location</b><br/>{STORE_LOCATION}", styles["info_text"]),
            ]
        ],
        colWidths=[page_width / 3.0] * 3,
    )
    contact_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fbf8")),
                ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#dbe6db")),
                ("INNERGRID", (0, 0), (-1, -1), 0.6, colors.HexColor("#dbe6db")),
                ("LEFTPADDING", (0, 0), (-1, -1), 9),
                ("RIGHTPADDING", (0, 0), (-1, -1), 9),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    story.extend(
        [
            _receipt_section_header("Contact Us", page_width, styles),
            Spacer(1, 6),
            contact_table,
            Spacer(1, 8),
            Paragraph(
                "This receipt is issued because your payment has been confirmed by Zansupermarket.",
                styles["small"],
            ),
        ]
    )

    doc.build(story)
    return buffer.getvalue()


class IsAdminRole(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == "admin")


class IsSupplierRole(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == "supplier")


class IsDriverRole(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == "driver")


class IsCustomerRole(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == "customer")


def token_payload_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        "refresh": str(refresh),
        "access": str(refresh.access_token),
        "user": UserSerializer(user).data,
    }


class RoleLoginView(APIView):
    permission_classes = [permissions.AllowAny]
    required_role = None

    def post(self, request):
        try:
            username = request.data.get("username")
            password = request.data.get("password")
            user = authenticate(request=request, username=username, password=password)
            if not user:
                return Response({"detail": "Invalid credentials."}, status=status.HTTP_401_UNAUTHORIZED)
            if self.required_role and user.role != self.required_role:
                return Response({"detail": f"Only {self.required_role} can login here."}, status=status.HTTP_403_FORBIDDEN)
            return Response(token_payload_for_user(user), status=status.HTTP_200_OK)
        except DatabaseError:
            return Response({"detail": "Authentication is temporarily unavailable."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


class CustomerLoginView(RoleLoginView):
    required_role = "customer"


class AdminLoginView(RoleLoginView):
    required_role = "admin"


class SupplierLoginView(RoleLoginView):
    required_role = "supplier"


class DriverLoginView(RoleLoginView):
    required_role = "driver"


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        try:
            serializer = RegisterSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            user = serializer.save()
            return Response(UserSerializer(user, context={"request": request}).data, status=status.HTTP_201_CREATED)
        except DatabaseError:
            return Response({"detail": "Registration is temporarily unavailable."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


class AdminRegisterView(APIView):
    permission_classes = [permissions.AllowAny]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        try:
            if User.objects.filter(role="admin").exists():
                return Response({"detail": "Admin already exists. Use /admin/login."}, status=status.HTTP_403_FORBIDDEN)
            serializer = AdminRegisterSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            user = serializer.save()
            return Response(UserSerializer(user, context={"request": request}).data, status=status.HTTP_201_CREATED)
        except DatabaseError:
            return Response({"detail": "Admin registration is temporarily unavailable."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        try:
            serializer = UserSerializer(request.user, context={"request": request})
            return Response(serializer.data, status=status.HTTP_200_OK)
        except DatabaseError:
            return Response({"detail": "Profile service is temporarily unavailable."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    def patch(self, request):
        try:
            serializer = UserSerializer(
                request.user,
                data=request.data,
                partial=True,
                context={"request": request},
            )
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        except DatabaseError:
            return Response({"detail": "Profile update is temporarily unavailable."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [permissions.IsAuthenticated]


class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]


class CustomerViewSet(viewsets.ModelViewSet):
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.select_related("category", "supplier").all()
    serializer_class = ProductSerializer
    parser_classes = [MultiPartParser, FormParser]

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [permissions.AllowAny()]
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated(), IsAdminRole()]

    def get_serializer_class(self):
        if self.action == "list":
            return PublicProductSerializer
        return ProductSerializer

    def _serialize_products(self, products):
        serializer_class = self.get_serializer_class()
        context = self.get_serializer_context()
        serialized_products = []

        for product in products:
            try:
                serialized_products.append(serializer_class(product, context=context).data)
            except PRODUCT_SERIALIZATION_ERRORS:
                logger.exception("Skipping product %s because serialization failed.", product.pk)

        return serialized_products

    def _product_storage_error_response(self, action_name):
        logger.exception("Product %s failed because uploaded media could not be saved.", action_name)
        return Response(
            {"detail": "Product image upload is temporarily unavailable."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    def list(self, request, *args, **kwargs):
        try:
            queryset = self.filter_queryset(self.get_queryset())
            page = self.paginate_queryset(queryset)
            products = page if page is not None else queryset
            data = self._serialize_products(products)

            if page is not None:
                return self.get_paginated_response(data)
            return Response(data, status=status.HTTP_200_OK)
        except DatabaseError:
            logger.exception("Products list is temporarily unavailable because the database query failed.")
            return Response(
                {"detail": "Products are temporarily unavailable."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

    def retrieve(self, request, *args, **kwargs):
        try:
            instance = self.get_object()
            serializer = self.get_serializer(instance)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except DatabaseError:
            logger.exception("Product detail is temporarily unavailable because the database query failed.")
            return Response(
                {"detail": "This product is temporarily unavailable."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except PRODUCT_SERIALIZATION_ERRORS:
            logger.exception("Product %s could not be serialized.", kwargs.get(self.lookup_field))
            return Response(
                {"detail": "This product is temporarily unavailable."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

    def create(self, request, *args, **kwargs):
        try:
            return super().create(request, *args, **kwargs)
        except OSError:
            return self._product_storage_error_response("create")

    def update(self, request, *args, **kwargs):
        try:
            return super().update(request, *args, **kwargs)
        except OSError:
            return self._product_storage_error_response("update")

    def partial_update(self, request, *args, **kwargs):
        try:
            return super().partial_update(request, *args, **kwargs)
        except OSError:
            return self._product_storage_error_response("update")

    def perform_create(self, serializer):
        if self.request.user.role == "supplier":
            supplier = Supplier.objects.filter(user=self.request.user).first()
            if not supplier:
                raise exceptions.PermissionDenied("Supplier profile is missing.")
            serializer.save(supplier=supplier)
            return
        if self.request.user.role != "admin":
            raise exceptions.PermissionDenied("Only admin or supplier can create products.")
        serializer.save()

    def _assert_can_manage_product(self, product):
        user = self.request.user
        if user.role == "admin":
            return
        if user.role == "supplier":
            supplier = Supplier.objects.filter(user=user).first()
            if not supplier:
                raise exceptions.PermissionDenied("Supplier profile is missing.")
            if product.supplier_id != supplier.id:
                raise exceptions.PermissionDenied("Suppliers can only manage their own products.")
            return
        raise exceptions.PermissionDenied("Only admin or supplier can manage products.")

    def perform_update(self, serializer):
        product = self.get_object()
        self._assert_can_manage_product(product)
        if self.request.user.role == "supplier":
            supplier = Supplier.objects.filter(user=self.request.user).first()
            serializer.save(supplier=supplier)
            return
        serializer.save()

    def perform_destroy(self, instance):
        self._assert_can_manage_product(instance)
        instance.delete()


class SaleViewSet(viewsets.ModelViewSet):
    queryset = Sale.objects.select_related("customer", "user", "assigned_driver").all()
    serializer_class = SaleSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy", "assign_driver"):
            return [permissions.IsAuthenticated(), IsAdminRole()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        if user.role == "admin":
            return self.queryset
        if user.role == "driver":
            return self.queryset.filter(assigned_driver=user)
        if user.role == "customer":
            return self.queryset.filter(user=user)
        return self.queryset.none()

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated, IsAdminRole])
    def assign_driver(self, request, pk=None):
        sale = self.get_object()
        driver_id = request.data.get("driver_id")
        driver = User.objects.filter(id=driver_id, role="driver").first()
        if not driver:
            return Response({"detail": "Driver not found."}, status=status.HTTP_404_NOT_FOUND)
        sale.assigned_driver = driver
        if sale.status in ("payment_confirmed", "processing"):
            sale.status = "out_for_delivery"
        sale.save(update_fields=["assigned_driver", "status"])
        return Response(SaleSerializer(sale, context={"request": request}).data, status=status.HTTP_200_OK)


class SaleItemViewSet(viewsets.ModelViewSet):
    queryset = SaleItem.objects.select_related("sale", "product").all()
    serializer_class = SaleItemSerializer
    permission_classes = [permissions.IsAuthenticated]


class StockViewSet(viewsets.ModelViewSet):
    queryset = StockMovement.objects.select_related("product", "sale_item").all()
    serializer_class = StockSerializer
    permission_classes = [permissions.IsAuthenticated]


class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.select_related("sale", "confirmed_by").all()
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ("admin_pending",):
            return PaymentAdminSerializer
        return PaymentSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role == "admin":
            return self.queryset
        if user.role == "customer":
            return self.queryset.filter(sale__user=user)
        return self.queryset.none()

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated, IsAdminRole])
    def confirm(self, request, pk=None):
        payment = self.get_object()
        payment.status = "confirmed"
        payment.confirmed_by = request.user
        payment.save()

        sale = payment.sale
        sale.payment_confirmed = True
        if sale.status == "pending_payment":
            sale.status = "payment_confirmed"
        sale.save()

        customer_name = (
            sale.customer_name_display
            if sale.customer_name_display
            else "Customer"
        )
        customer_email = sale.customer_email_display
        if customer_email:
            subject = f"Payment Confirmed - Control #{payment.control_number}"
            message = (
                f"Hello {customer_name},\n\n"
                f"Your payment is confirmed.\n"
                f"Control Number: {payment.control_number}\n"
                f"Order ID: {sale.id}\n"
                f"Total: {sale.final_amount}\n"
                f"Delivery location: {sale.delivery_location or 'Not provided'}\n"
                "Thank you for shopping with Zanzibar Super System."
            )
            send_mail(
                subject=subject,
                message=message,
                from_email="noreply@zansupermarket.local",
                recipient_list=[customer_email],
                fail_silently=True,
            )
        return Response(PaymentSerializer(payment).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], permission_classes=[permissions.IsAuthenticated, IsAdminRole])
    def admin_pending(self, request):
        payments = self.queryset.filter(status="pending").select_related("sale", "sale__user")
        serializer = self.get_serializer(payments, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class AdminCreateUserView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        try:
            serializer = AdminCreateUserSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            user = serializer.save()
            return Response(UserSerializer(user, context={"request": request}).data, status=status.HTTP_201_CREATED)
        except DatabaseError:
            return Response({"detail": "User creation is temporarily unavailable."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


class CheckoutView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsCustomerRole]

    def _checkout_unavailable_response(self):
        logger.exception("Customer checkout failed because the database transaction could not complete.")
        return Response(
            {"detail": "Unable to place this order right now. Please try again shortly."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    @transaction.atomic
    def post(self, request):
        try:
            serializer = CheckoutSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            data = serializer.validated_data

            customer = Customer.objects.filter(user=request.user).first()
            if not customer:
                customer = Customer.objects.create(user=request.user, phone=request.user.phone)

            items_payload = data["items"]
            if not items_payload:
                return Response({"detail": "Cart is empty."}, status=status.HTTP_400_BAD_REQUEST)

            product_ids = [item["product"] for item in items_payload]
            product_map = {
                product.id: product
                for product in Product.objects.select_for_update().filter(id__in=product_ids)
            }
            total_amount = Decimal("0.00")
            sale_items = []
            customer_full_name = data.get("customer_full_name") or request.user.full_name or request.user.username
            customer_email = data.get("customer_email") or request.user.email or ""
            customer_phone = data.get("customer_phone") or request.user.phone or ""
            customer_address = data.get("customer_address") or request.user.address or ""

            for item in items_payload:
                product = product_map.get(item["product"])
                if not product:
                    return Response({"detail": f"Product {item['product']} not found."}, status=status.HTTP_400_BAD_REQUEST)
                qty = item["quantity"]
                if product.quantity < qty:
                    return Response({"detail": f"Not enough stock for {product.name}."}, status=status.HTTP_400_BAD_REQUEST)
                total_amount += product.price * qty
                sale_items.append((product, qty))

            sale = Sale.objects.create(
                customer=customer,
                user=request.user,
                total_amount=total_amount,
                tax=Decimal("0.00"),
                discount=Decimal("0.00"),
                final_amount=total_amount,
                payment_method=data.get("payment_method", "mobile_money"),
                payment_confirmed=False,
                delivery_location=data.get("delivery_location", ""),
                terms_accepted=data.get("terms_accepted", False),
                customer_full_name=customer_full_name,
                customer_email=customer_email,
                customer_phone=customer_phone,
                customer_address=customer_address,
                status="pending_payment",
            )

            for product, qty in sale_items:
                sale_item = SaleItem.objects.create(
                    sale=sale,
                    product=product,
                    quantity=qty,
                    price=product.price,
                    total=product.price * qty,
                )
                product.quantity -= qty
                product.save(update_fields=["quantity"])
                StockMovement.objects.create(product=product, sale_item=sale_item, quantity=qty, movement_type="OUT")

            payment = Payment.objects.create(
                sale=sale,
                payment_method=data.get("payment_method", "mobile_money"),
                status="pending",
            )

            items_text = "\n".join(
                [f"- {product.name} x{qty} @ {product.price} = {product.price * qty}" for product, qty in sale_items]
            )
            subject = f"Order Received - Control #{payment.control_number}"
            message = (
                f"Hello {customer_full_name},\n\n"
                f"Your order was created successfully.\n"
                f"Order ID: {sale.id}\n"
                f"Control Number: {payment.control_number}\n"
                f"Payment Method: {payment.payment_method}\n"
                f"Payment Status: {payment.status}\n"
                f"Total: {sale.final_amount}\n"
                f"Phone: {customer_phone or 'Not provided'}\n"
                f"Address: {customer_address or 'Not provided'}\n"
                f"Delivery location: {sale.delivery_location or 'Not provided'}\n\n"
                f"Items:\n{items_text}\n\n"
                "Your payment is pending admin confirmation. Thank you for shopping with Zanzibar Super System."
            )
            recipient_email = customer_email or request.user.email or ""
            if recipient_email:
                send_mail(
                    subject=subject,
                    message=message,
                    from_email="noreply@zansupermarket.local",
                    recipient_list=[recipient_email],
                    fail_silently=True,
                )

            admin_emails = list(
                User.objects.filter(role="admin", is_active=True).exclude(email="").values_list("email", flat=True)
            )
            if admin_emails:
                send_mail(
                    subject=f"Payment Confirmation Needed - Order #{sale.id}",
                    message=(
                        f"A new order requires payment confirmation.\n"
                        f"Order ID: {sale.id}\n"
                        f"Control Number: {payment.control_number}\n"
                        f"Customer: {customer_full_name} ({customer_email or 'No email'})\n"
                        f"Phone: {customer_phone or 'Not provided'}\n"
                        f"Address: {customer_address or 'Not provided'}\n"
                        f"Delivery location: {sale.delivery_location or 'Not provided'}\n"
                        f"Total: {sale.final_amount}\n"
                        f"Payment Method: {payment.payment_method}\n"
                        f"Status: {payment.status}\n"
                    ),
                    from_email="noreply@zansupermarket.local",
                    recipient_list=admin_emails,
                    fail_silently=True,
                )

            return Response(
                {
                    "sale": SaleSerializer(sale, context={"request": request}).data,
                    "payment": PaymentSerializer(payment, context={"request": request}).data,
                    "whatsapp_url": build_whatsapp_order_url(sale, payment, sale_items),
                },
                status=status.HTTP_201_CREATED,
            )
        except DatabaseError:
            return self._checkout_unavailable_response()


class CustomerOrdersView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsCustomerRole]

    def get(self, request):
        sales = Sale.objects.filter(user=request.user).select_related("payment").prefetch_related("items__product")
        serializer = SaleSerializer(sales, many=True, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class CustomerReceiptView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsCustomerRole]

    def get(self, request, sale_id):
        sale = (
            Sale.objects.filter(id=sale_id, user=request.user)
            .select_related("payment")
            .prefetch_related("items__product")
            .first()
        )
        if not sale:
            return Response({"detail": "Order not found."}, status=status.HTTP_404_NOT_FOUND)
        payment = getattr(sale, "payment", None)
        if not payment or payment.status != "confirmed":
            return Response(
                {"detail": "Receipt is available after payment confirmation."},
                status=status.HTTP_409_CONFLICT,
            )

        response = HttpResponse(build_receipt_pdf(sale), content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="receipt-order-{sale.id}.pdf"'
        return response


class SupplierDashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsSupplierRole]

    def get(self, request):
        supplier = Supplier.objects.filter(user=request.user).first()
        if not supplier:
            return Response({"detail": "Supplier profile not found."}, status=status.HTTP_404_NOT_FOUND)
        products = Product.objects.filter(supplier=supplier)
        low_stock = products.filter(quantity__lte=5).count()
        return Response(
            {
                "supplier": SupplierSerializer(supplier).data,
                "products_count": products.count(),
                "low_stock_count": low_stock,
                "products": ProductSerializer(products, many=True, context={"request": request}).data,
            },
            status=status.HTTP_200_OK,
        )


class DriverDashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsDriverRole]

    def get(self, request):
        sales = Sale.objects.filter(assigned_driver=request.user).exclude(status="delivered")
        return Response(
            {
                "driver": UserSerializer(request.user, context={"request": request}).data,
                "active_deliveries": SaleSerializer(sales, many=True, context={"request": request}).data,
            },
            status=status.HTTP_200_OK,
        )


class DriverUpdateDeliveryView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsDriverRole]

    def patch(self, request, sale_id):
        sale = Sale.objects.filter(id=sale_id, assigned_driver=request.user).first()
        if not sale:
            return Response({"detail": "Delivery not found."}, status=status.HTTP_404_NOT_FOUND)
        next_status = request.data.get("status")
        if next_status not in ("out_for_delivery", "delivered"):
            return Response({"detail": "Invalid status for driver."}, status=status.HTTP_400_BAD_REQUEST)
        sale.status = next_status
        sale.save(update_fields=["status"])
        return Response(SaleSerializer(sale, context={"request": request}).data, status=status.HTTP_200_OK)
