import logging
from textwrap import wrap
from urllib.parse import quote
from decimal import Decimal
from django.contrib.auth import authenticate, get_user_model
from django.core.mail import send_mail
from django.core.exceptions import SuspiciousOperation
from django.db import DatabaseError, transaction
from django.http import HttpResponse
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


def _pdf_escape(value):
    text = str(value)
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _receipt_text_lines(sale):
    lines = [
        "Zanzibar Supermarket Receipt",
        f"Receipt for Order #{sale.id}",
        f"Control Number: {sale.payment.control_number}",
        f"Payment Status: {sale.payment.status}",
        f"Order Date: {sale.created_at:%Y-%m-%d %H:%M}",
        "",
        f"Customer: {sale.customer_name_display or 'Customer'}",
        f"Email: {sale.customer_email_display or 'Not provided'}",
        f"Phone: {sale.customer_phone_display or 'Not provided'}",
        f"Address: {sale.customer_address_display or 'Not provided'}",
        f"Delivery Location: {sale.delivery_location or 'Not provided'}",
        "",
        "Products:",
    ]

    for item in sale.items.all():
        lines.append(
            f"- {item.product_name if hasattr(item, 'product_name') else item.product.name} x{item.quantity} @ TZS {item.price} = TZS {item.total}"
        )

    lines.extend(
        [
            "",
            f"Subtotal: TZS {sale.total_amount}",
            f"Discount: TZS {sale.discount}",
            f"Tax: TZS {sale.tax}",
            f"Final Amount: TZS {sale.final_amount}",
            "",
            "Thank you for shopping with Zanzibar Supermarket.",
        ]
    )
    wrapped_lines = []
    for line in lines:
        if not line:
            wrapped_lines.append("")
            continue
        wrapped_lines.extend(wrap(line, width=92) or [""])
    return wrapped_lines


def build_receipt_pdf(sale):
    lines = _receipt_text_lines(sale)
    lines_per_page = 48
    pages = [lines[index:index + lines_per_page] for index in range(0, len(lines), lines_per_page)] or [[]]
    font_object_id = 3 + len(pages) * 2
    objects = []

    page_refs = " ".join(f"{3 + index * 2} 0 R" for index in range(len(pages)))
    objects.append((1, b"<< /Type /Catalog /Pages 2 0 R >>"))
    objects.append((2, f"<< /Type /Pages /Kids [{page_refs}] /Count {len(pages)} >>".encode("ascii")))

    for index, page_lines in enumerate(pages):
        page_object_id = 3 + index * 2
        content_object_id = page_object_id + 1
        commands = [
            "BT",
            "/F1 12 Tf",
            "50 800 Td",
            f"(Zanzibar Supermarket Receipt - Page {index + 1}) Tj",
            "0 -20 Td",
            "/F1 10 Tf",
        ]
        for line in page_lines:
            commands.append(f"({_pdf_escape(line)}) Tj")
            commands.append("0 -14 Td")
        commands.append("ET")
        stream = "\n".join(commands).encode("latin-1", errors="ignore")
        page_body = (
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
            f"/Resources << /Font << /F1 {font_object_id} 0 R >> >> "
            f"/Contents {content_object_id} 0 R >>"
        ).encode("ascii")
        content_body = (
            f"<< /Length {len(stream)} >>\nstream\n".encode("ascii")
            + stream
            + b"\nendstream"
        )
        objects.append((page_object_id, page_body))
        objects.append((content_object_id, content_body))

    objects.append((font_object_id, b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"))
    objects.sort(key=lambda item: item[0])

    pdf = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for object_id, body in objects:
        offsets.append(len(pdf))
        pdf.extend(f"{object_id} 0 obj\n".encode("ascii"))
        pdf.extend(body)
        pdf.extend(b"\nendobj\n")

    xref_offset = len(pdf)
    pdf.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    pdf.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        pdf.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
    pdf.extend(
        (
            f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
            f"startxref\n{xref_offset}\n%%EOF"
        ).encode("ascii")
    )
    return bytes(pdf)


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
