from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ("supermarketzanzibar", "0006_database_only_image_storage"),
    ]

    operations = [
        migrations.CreateModel(
            name="SystemSubscriptionControl",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("control_enabled", models.BooleanField(default=False)),
                ("service_id", models.CharField(blank=True, default="", max_length=120)),
                ("license_key", models.CharField(blank=True, default="", max_length=255)),
                ("api_key", models.CharField(blank=True, default="", max_length=255)),
                ("api_secret", models.CharField(blank=True, default="", max_length=255)),
                ("api_url", models.URLField(blank=True, default="")),
                ("license_validate_url", models.URLField(blank=True, default="")),
                ("subscription_status_url", models.URLField(blank=True, default="")),
                ("heartbeat_url", models.URLField(blank=True, default="")),
                (
                    "subscription_status",
                    models.CharField(
                        choices=[
                            ("unknown", "Unknown"),
                            ("active", "Active"),
                            ("trial", "Trial"),
                            ("suspended", "Suspended"),
                            ("cancelled", "Cancelled"),
                            ("expired", "Expired"),
                        ],
                        default="unknown",
                        max_length=20,
                    ),
                ),
                ("subscription_end_date", models.DateField(blank=True, null=True)),
                ("last_validated_at", models.DateTimeField(blank=True, null=True)),
                ("last_error", models.TextField(blank=True, default="")),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now, editable=False)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "System Subscription Control",
                "verbose_name_plural": "System Subscription Control",
                "ordering": ["-updated_at", "-id"],
            },
        ),
    ]
