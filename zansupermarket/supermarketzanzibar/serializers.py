from django.contrib.auth import get_user_model
from rest_framework import serializers
from .models import Category, Customer, Payment, Product, Sale, SaleItem, StockMovement, Supplier

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, min_length=8)
    profile_image_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "full_name",
            "phone",
            "address",
            "profile_image",
            "profile_image_url",
            "role",
            "is_active",
            "created_at",
            "updated_at",
            "password",
        )
        read_only_fields = ("created_at", "updated_at", "role")

    def get_profile_image_url(self, obj):
        if not obj.profile_image:
            return None
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(obj.profile_image.url)
        return obj.profile_image.url

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        user = User(**validated_data)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "full_name",
            "phone",
            "address",
            "profile_image",
            "password",
            "password_confirm",
        )

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({"password_confirm": "Passwords do not match."})
        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        password = validated_data.pop("password")
        user = User(role="customer", **validated_data)
        user.set_password(password)
        user.save()
        Customer.objects.get_or_create(user=user, defaults={"phone": user.phone})
        return user


class AdminRegisterSerializer(RegisterSerializer):
    def create(self, validated_data):
        validated_data.pop("password_confirm")
        password = validated_data.pop("password")
        user = User(role="admin", **validated_data)
        user.set_password(password)
        user.save()
        return user


class AdminCreateUserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, min_length=8)
    company_name = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = (
            "username",
            "email",
            "full_name",
            "phone",
            "address",
            "profile_image",
            "role",
            "password",
            "password_confirm",
            "company_name",
        )

    def validate_role(self, value):
        if value not in ("supplier", "driver", "customer"):
            raise serializers.ValidationError("Admin can only create supplier, driver, or customer users.")
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({"password_confirm": "Passwords do not match."})
        return attrs

    def create(self, validated_data):
        company_name = validated_data.pop("company_name", "")
        validated_data.pop("password_confirm")
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        if user.role == "supplier":
            Supplier.objects.get_or_create(
                user=user,
                defaults={
                    "company_name": company_name or f"{user.full_name} Supplies",
                    "phone": user.phone,
                    "address": user.address or "",
                },
            )
        if user.role == "customer":
            Customer.objects.get_or_create(user=user, defaults={"phone": user.phone})
        return user


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = "__all__"


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = "__all__"


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = "__all__"


class ProductSerializer(serializers.ModelSerializer):
    category = serializers.CharField(required=False, allow_blank=True, allow_null=True, write_only=True)
    category_id = serializers.IntegerField(source="category.id", read_only=True)
    image_url = serializers.SerializerMethodField()
    category_name = serializers.CharField(source="category.name", read_only=True)

    class Meta:
        model = Product
        fields = "__all__"

    def _resolve_category(self, raw_value):
        if raw_value in (None, ""):
            return None
        text = str(raw_value).strip()
        if not text:
            return None
        if text.isdigit():
            category_by_id = Category.objects.filter(pk=int(text)).first()
            if category_by_id:
                return category_by_id
        category, _ = Category.objects.get_or_create(name=text)
        return category

    def create(self, validated_data):
        raw_category = validated_data.pop("category", None)
        validated_data["category"] = self._resolve_category(raw_category)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if "category" in validated_data:
            raw_category = validated_data.pop("category")
            validated_data["category"] = self._resolve_category(raw_category)
        return super().update(instance, validated_data)

    def get_image_url(self, obj):
        if not obj.image:
            return None
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(obj.image.url)
        return obj.image.url


class PublicProductSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    category_name = serializers.CharField(source="category.name", read_only=True)

    class Meta:
        model = Product
        fields = (
            "id",
            "name",
            "slug",
            "price",
            "quantity",
            "image",
            "image_url",
            "description",
            "category_name",
        )

    def get_image_url(self, obj):
        if not obj.image:
            return None
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(obj.image.url)
        return obj.image.url


class SaleItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = SaleItem
        fields = "__all__"


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = "__all__"
        read_only_fields = ("control_number", "confirmed_by")


class PaymentAdminSerializer(serializers.ModelSerializer):
    sale_id = serializers.IntegerField(source="sale.id", read_only=True)
    sale_status = serializers.CharField(source="sale.status", read_only=True)
    customer_name = serializers.CharField(source="sale.user.full_name", read_only=True)
    customer_email = serializers.EmailField(source="sale.user.email", read_only=True)

    class Meta:
        model = Payment
        fields = (
            "id",
            "control_number",
            "status",
            "payment_method",
            "created_at",
            "sale_id",
            "sale_status",
            "customer_name",
            "customer_email",
        )


class SaleSerializer(serializers.ModelSerializer):
    items = SaleItemSerializer(many=True, read_only=True)
    payment = PaymentSerializer(read_only=True)
    payment_control_number = serializers.CharField(source="payment.control_number", read_only=True)
    payment_status = serializers.CharField(source="payment.status", read_only=True)

    class Meta:
        model = Sale
        fields = "__all__"


class StockSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockMovement
        fields = "__all__"


class CheckoutItemSerializer(serializers.Serializer):
    product = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)


class CheckoutSerializer(serializers.Serializer):
    items = CheckoutItemSerializer(many=True)
    payment_method = serializers.CharField(default="mobile_money")
    delivery_location = serializers.CharField(required=False, allow_blank=True)
    terms_accepted = serializers.BooleanField(default=False)
