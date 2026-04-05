from io import BytesIO
from pathlib import Path
from PIL import Image
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone
from django.utils.text import slugify
from os.path import basename
import random
import string

# ================================
# Custom User Model
# ================================

class CustomUser(AbstractUser):

    ROLE_CHOICES = (
        ('admin', 'Admin'),
        ('customer', 'Customer'),
        ('supplier', 'Supplier'),
        ('driver', 'Delivery Driver'),
        ('cashier', 'Cashier'),
    )

    phone = models.CharField(max_length=20, unique=True)
    full_name = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    address = models.TextField(blank=True, null=True)
    profile_image_data = models.BinaryField(null=True, blank=True)
    profile_image_name = models.CharField(max_length=255, blank=True, default="")
    profile_image_content_type = models.CharField(max_length=100, blank=True, default="")
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.username} ({self.role})"

    @property
    def has_profile_image(self):
        return bool(self.profile_image_data)

    def set_profile_image(self, uploaded_file):
        if uploaded_file is None:
            self.clear_profile_image()
            return

        if hasattr(uploaded_file, "seek"):
            uploaded_file.seek(0)
        source_name = basename(getattr(uploaded_file, "name", "") or "profile-image")
        source_stem = Path(source_name).stem or "profile-image"
        source_bytes = uploaded_file.read()

        with Image.open(BytesIO(source_bytes)) as image:
            if image.mode not in ("RGB", "L"):
                image = image.convert("RGB")
            elif image.mode == "L":
                image = image.convert("RGB")

            output = BytesIO()
            image.save(output, format="JPEG", quality=90)

        self.profile_image_data = output.getvalue()
        self.profile_image_name = f"{source_stem}.jpg"
        self.profile_image_content_type = "image/jpeg"

    def clear_profile_image(self):
        self.profile_image_data = None
        self.profile_image_name = ""
        self.profile_image_content_type = ""


# ================================
# Category Model
# ================================

class Category(models.Model):

    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name


# ================================
# Supplier Model
# ================================

class Supplier(models.Model):

    user = models.OneToOneField(
        CustomUser, on_delete=models.CASCADE, related_name="supplier_profile"
    )
    company_name = models.CharField(max_length=255)
    phone = models.CharField(max_length=20)
    address = models.TextField()
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.company_name


# ================================
# Customer Model
# ================================

class Customer(models.Model):

    user = models.OneToOneField(
        CustomUser, on_delete=models.CASCADE, related_name="customer_profile"
    )
    phone = models.CharField(max_length=20)
    loyalty_points = models.IntegerField(default=0)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.user.full_name


# ================================
# Product Model
# ================================

class Product(models.Model):

    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True)
    supplier = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True)

    price = models.DecimalField(max_digits=10, decimal_places=2)
    cost_price = models.DecimalField(max_digits=10, decimal_places=2)

    quantity = models.IntegerField(default=0)

    barcode = models.CharField(max_length=100, unique=True)

    image_data = models.BinaryField(null=True, blank=True)
    image_name = models.CharField(max_length=255, blank=True, default="")
    image_content_type = models.CharField(max_length=100, blank=True, default="")

    description = models.TextField(blank=True)

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.name) or "product"
            slug = base_slug
            counter = 1
            while Product.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            self.slug = slug
        super().save(*args, **kwargs)

    @property
    def has_database_image(self):
        return bool(self.image_data)

    def set_database_image(self, uploaded_file):
        if uploaded_file is None:
            self.clear_database_image()
            return

        if hasattr(uploaded_file, "seek"):
            uploaded_file.seek(0)

        source_name = basename(getattr(uploaded_file, "name", "") or "product-image")
        source_stem = Path(source_name).stem or "product-image"
        source_bytes = uploaded_file.read()

        with Image.open(BytesIO(source_bytes)) as image:
            if image.mode not in ("RGB", "L"):
                image = image.convert("RGB")
            elif image.mode == "L":
                image = image.convert("RGB")

            output = BytesIO()
            image.save(output, format="JPEG", quality=90)

        self.image_data = output.getvalue()
        self.image_name = f"{source_stem}.jpg"
        self.image_content_type = "image/jpeg"

    def clear_database_image(self):
        self.image_data = None
        self.image_name = ""
        self.image_content_type = ""

    def __str__(self):
        return self.name


# ================================
# Sale Model
# ================================

class Sale(models.Model):
    STATUS_CHOICES = (
        ("pending_payment", "Pending Payment"),
        ("payment_confirmed", "Payment Confirmed"),
        ("processing", "Processing"),
        ("out_for_delivery", "Out For Delivery"),
        ("delivered", "Delivered"),
        ("cash_completed", "Cash Completed"),
    )

    customer = models.ForeignKey(Customer, on_delete=models.SET_NULL, null=True)

    user = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True)

    total_amount = models.DecimalField(max_digits=12, decimal_places=2)

    tax = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    discount = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    final_amount = models.DecimalField(max_digits=12, decimal_places=2)

    payment_method = models.CharField(max_length=50)
    payment_confirmed = models.BooleanField(default=False)
    terms_accepted = models.BooleanField(default=False)
    delivery_location = models.TextField(blank=True, null=True)
    customer_full_name = models.CharField(max_length=255, blank=True)
    customer_email = models.EmailField(blank=True)
    customer_phone = models.CharField(max_length=20, blank=True)
    customer_address = models.TextField(blank=True)
    assigned_driver = models.ForeignKey(
        CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name="assigned_sales"
    )
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default="pending_payment")

    date = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        self.final_amount = self.total_amount - self.discount + self.tax
        super().save(*args, **kwargs)

    @property
    def customer_name_display(self):
        if self.customer_full_name:
            return self.customer_full_name
        return self.user.full_name if self.user and getattr(self.user, "full_name", None) else ""

    @property
    def customer_email_display(self):
        if self.customer_email:
            return self.customer_email
        return self.user.email if self.user and getattr(self.user, "email", None) else ""

    @property
    def customer_phone_display(self):
        if self.customer_phone:
            return self.customer_phone
        return self.user.phone if self.user and getattr(self.user, "phone", None) else ""

    @property
    def customer_address_display(self):
        if self.customer_address:
            return self.customer_address
        return self.user.address if self.user and getattr(self.user, "address", None) else ""

    def __str__(self):
        return f"Sale #{self.id}"


# ================================
# Sale Item Model
# ================================

class SaleItem(models.Model):

    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name="items")

    product = models.ForeignKey(Product, on_delete=models.CASCADE)

    quantity = models.IntegerField()

    price = models.DecimalField(max_digits=10, decimal_places=2)

    total = models.DecimalField(max_digits=12, decimal_places=2)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        self.total = self.quantity * self.price
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.product.name} x {self.quantity}"


# ================================
# Stock Movement
# ================================

class StockMovement(models.Model):
    MOVEMENT_CHOICES = (
        ("IN", "Stock In"),
        ("OUT", "Stock Out"),
    )

    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    sale_item = models.ForeignKey(
        SaleItem, on_delete=models.SET_NULL, null=True, blank=True, related_name="stock_movements"
    )

    quantity = models.IntegerField()

    movement_type = models.CharField(max_length=10, choices=MOVEMENT_CHOICES)

    date = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date"]

    def __str__(self):
        return f"{self.product.name} ({self.movement_type})"


class Payment(models.Model):
    STATUS_CHOICES = (
        ("pending", "Pending"),
        ("confirmed", "Confirmed"),
        ("rejected", "Rejected"),
    )

    sale = models.OneToOneField(Sale, on_delete=models.CASCADE, related_name="payment")
    control_number = models.CharField(max_length=20, unique=True, blank=True)
    payment_method = models.CharField(max_length=50, default="mobile_money")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    confirmed_by = models.ForeignKey(
        CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name="confirmed_payments"
    )
    proof_image_data = models.BinaryField(null=True, blank=True)
    proof_image_name = models.CharField(max_length=255, blank=True, default="")
    proof_image_content_type = models.CharField(max_length=100, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def _generate_control_number(self):
        prefix = timezone.now().strftime("%y%m%d")
        token = "".join(random.choices(string.digits, k=8))
        return f"ZN{prefix}{token}"

    def save(self, *args, **kwargs):
        if not self.control_number:
            candidate = self._generate_control_number()
            while Payment.objects.filter(control_number=candidate).exists():
                candidate = self._generate_control_number()
            self.control_number = candidate
        super().save(*args, **kwargs)

    @property
    def has_proof_image(self):
        return bool(self.proof_image_data)

    def set_proof_image(self, uploaded_file):
        if uploaded_file is None:
            self.clear_proof_image()
            return

        if hasattr(uploaded_file, "seek"):
            uploaded_file.seek(0)
        source_name = basename(getattr(uploaded_file, "name", "") or "payment-proof")
        source_stem = Path(source_name).stem or "payment-proof"
        source_bytes = uploaded_file.read()

        with Image.open(BytesIO(source_bytes)) as image:
            if image.mode not in ("RGB", "L"):
                image = image.convert("RGB")
            elif image.mode == "L":
                image = image.convert("RGB")

            output = BytesIO()
            image.save(output, format="JPEG", quality=90)

        self.proof_image_data = output.getvalue()
        self.proof_image_name = f"{source_stem}.jpg"
        self.proof_image_content_type = "image/jpeg"

    def clear_proof_image(self):
        self.proof_image_data = None
        self.proof_image_name = ""
        self.proof_image_content_type = ""

    def __str__(self):
        return f"{self.control_number} ({self.status})"
