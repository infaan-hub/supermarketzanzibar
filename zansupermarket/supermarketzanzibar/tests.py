from unittest.mock import patch

from django.db import DatabaseError
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Category, Product
from .serializers import PublicProductSerializer, safe_media_url


class BrokenFile:
    def __bool__(self):
        return True

    @property
    def url(self):
        raise ValueError("broken media path")


class SafeMediaUrlTests(TestCase):
    def test_returns_none_for_broken_media_field(self):
        self.assertIsNone(safe_media_url(BrokenFile()))


@override_settings(ALLOWED_HOSTS=["testserver", "127.0.0.1", "localhost"])
class ProductApiTests(APITestCase):
    def setUp(self):
        self.category = Category.objects.create(name="Groceries")

    def create_product(self, **overrides):
        defaults = {
            "name": "Rice",
            "slug": "rice",
            "category": self.category,
            "price": "2000.00",
            "cost_price": "1500.00",
            "quantity": 25,
            "barcode": "rice-001",
            "description": "Imported rice",
        }
        defaults.update(overrides)
        return Product.objects.create(**defaults)

    def test_public_products_list_returns_public_payload(self):
        product = self.create_product()

        response = self.client.get("/api/products/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], product.id)
        self.assertEqual(response.data[0]["category_name"], self.category.name)
        self.assertEqual(response.data[0]["image"], None)
        self.assertEqual(response.data[0]["image_url"], None)

    def test_public_products_list_skips_products_that_fail_serialization(self):
        good_product = self.create_product(name="Sugar", slug="sugar", barcode="sugar-001")
        broken_product = self.create_product(name="Salt", slug="salt", barcode="salt-001")
        original_to_representation = PublicProductSerializer.to_representation

        def flaky_to_representation(serializer, instance):
            if instance.pk == broken_product.pk:
                raise ValueError("broken product payload")
            return original_to_representation(serializer, instance)

        with patch.object(
            PublicProductSerializer,
            "to_representation",
            autospec=True,
            side_effect=flaky_to_representation,
        ):
            response = self.client.get("/api/products/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["id"] for item in response.data], [good_product.id])

    def test_public_products_list_returns_503_when_database_fails(self):
        with patch("supermarketzanzibar.views.ProductViewSet.get_queryset", side_effect=DatabaseError("db down")):
            response = self.client.get("/api/products/")

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.data["detail"], "Products are temporarily unavailable.")

    def test_public_product_detail_returns_503_when_database_fails(self):
        product = self.create_product()

        with patch("supermarketzanzibar.views.ProductViewSet.get_object", side_effect=DatabaseError("db down")):
            response = self.client.get(f"/api/products/{product.id}/")

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.data["detail"], "This product is temporarily unavailable.")
