# Domain Access Portal

A secure Azure-hosted portal that allows authorized organizations to retrieve
their assigned access code by entering their registered domain. Built with
Azure Static Web Apps, Azure Functions, and Azure Table Storage.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        GitHub                               │
│  main branch push  →  GitHub Actions  →  SWA deploy        │
└────────────────────────────┬────────────────────────────────┘
                             │
              ┌──────────────▼──────────────┐
              │   Azure Static Web App       │
              │   ┌──────────┐ ┌──────────┐ │
              │   │ Frontend │ │  /api/*  │ │
              │   │ src/     │ │ Functions│ │
              │   └──────────┘ └────┬─────┘ │
              └────────────────────┼────────┘
                                   │
              ┌────────────────────▼────────┐
              │   Azure Table Storage        │
              │   Table: domaincodes         │
              │   PK: "domains"              │
              │   RK: domain (dots→pipes)    │
              └─────────────────────────────┘
```

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Terraform | >= 1.3 | https://developer.hashicorp.com/terraform/downloads |
| Azure CLI | latest | https://learn.microsoft.com/en-us/cli/azure/install-azure-cli |
| Node.js | >= 18 | https://nodejs.org |
| Python | >= 3.10 | https://python.org |
| Azure Functions Core Tools | v4 | `npm install -g azure-functions-core-tools@4` |

---

## Quick Start

### 1. Clone and configure

```bash
git clone https://github.com/YOUR_ORG/domain-portal.git
cd domain-portal

# Create Terraform vars from example
cp terraform/terraform.tfvars.example terraform/terraform.tfvars
# Edit terraform/terraform.tfvars — fill in tenant_id, subscription_id, etc.
```

### 2. Provision Azure infrastructure

```bash
# Log in to Azure
az login
az account set --subscription "<your-subscription-id>"

cd terraform
terraform init
terraform plan
terraform apply
```

After apply completes, capture the outputs:

```bash
terraform output static_web_app_url
terraform output -raw static_web_app_api_key      # → AZURE_STATIC_WEB_APPS_API_TOKEN
terraform output -raw storage_connection_string    # → STORAGE_CONNECTION_STRING
terraform output static_web_app_url               # → SWA_DEFAULT_HOSTNAME (without https://)
```

### 3. Set SWA app settings (Function env vars)

```bash
az staticwebapp appsettings set \
  --name "swa-domain-portal" \
  --resource-group "rg-domain-portal" \
  --setting-names \
    STORAGE_CONNECTION_STRING="$(terraform output -raw storage_connection_string)" \
    ALLOWED_ORIGIN="https://$(terraform output -raw static_web_app_url | sed 's|https://||')"
```

### 4. Seed domain-code data from Excel

Install dependencies and run the seed script:

```bash
cd scripts
pip install -r requirements.txt

python seed_data.py \
  --file "/path/to/your/domains_and_codes.xlsx" \
  --connection-string "$(cd ../terraform && terraform output -raw storage_connection_string)" \
  --table domaincodes
```

**Excel format expected:**

| domain | code | label (optional) |
|--------|------|------------------|
| contoso.com | ABC-123-XYZ | Contoso Inc. |
| fabrikam.com | DEF-456-UVW | Fabrikam Corp |

Column headers are case-insensitive. Domains are normalized automatically
(strips https://, www., paths, and ports).

### 5. Configure GitHub Secrets

In your GitHub repository, go to **Settings → Secrets and Variables → Actions**
and add the following secrets:

| Secret Name | Value |
|-------------|-------|
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | Output from `terraform output -raw static_web_app_api_key` |
| `AZURE_CREDENTIALS` | JSON from `az ad sp create-for-rbac` (see below) |
| `STORAGE_CONNECTION_STRING` | Output from `terraform output -raw storage_connection_string` |
| `SWA_APP_NAME` | Your SWA name (e.g. `swa-domain-portal`) |
| `SWA_RESOURCE_GROUP` | Your resource group name |
| `SWA_DEFAULT_HOSTNAME` | SWA hostname without https:// |

**Create Azure credentials for GitHub Actions:**

```bash
az ad sp create-for-rbac \
  --name "sp-github-domain-portal" \
  --role contributor \
  --scopes /subscriptions/<subscription-id>/resourceGroups/rg-domain-portal \
  --sdk-auth
```

Copy the full JSON output as `AZURE_CREDENTIALS`.

### 6. Deploy

Push to `main` — GitHub Actions will build and deploy automatically.

```bash
git add .
git commit -m "Initial deploy"
git push origin main
```

---

## Project Structure

```
domain-portal/
├── .github/
│   └── workflows/
│       └── azure-static-web-apps.yml   # CI/CD pipeline
├── terraform/
│   ├── main.tf                          # Azure resource definitions
│   ├── variables.tf                     # Input variables
│   ├── outputs.tf                       # Output values
│   └── terraform.tfvars.example         # Config template
├── src/
│   └── index.html                       # Frontend portal (single file)
├── api/
│   ├── package.json
│   └── lookup/
│       ├── function.json                # HTTP trigger binding
│       └── index.js                     # Domain lookup logic
├── scripts/
│   ├── requirements.txt
│   └── seed_data.py                     # Excel → Table Storage seeder
├── staticwebapp.config.json             # SWA routing + security headers
├── .gitignore
└── README.md
```

---

## Security Notes

- **Codes are never in the frontend bundle** — all lookups go through the
  Azure Function which queries Table Storage server-side.
- **Security headers** are enforced via `staticwebapp.config.json`:
  `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, CSP, etc.
- **CORS** is locked to the SWA's own origin via the `ALLOWED_ORIGIN`
  app setting (set during deploy).
- **TLS 1.2+** is enforced on the storage account.
- The Function uses `anonymous` auth level — access is implicitly restricted
  to the SWA's own API path. For extra protection on the Standard SKU,
  you can enable **Private Endpoints** or **IP restrictions** on the SWA.

---

## Updating Domain/Code Data

Re-run the seed script at any time with updated Excel data:

```bash
python scripts/seed_data.py \
  --file "/path/to/updated_domains.xlsx" \
  --connection-string "<your-connection-string>"
```

Records are **upserted** (insert or overwrite), so existing records are
updated safely. Records not in the new file are **not deleted** automatically
— use `--dry-run` to preview changes first.

---

## Custom Domain

1. Set `custom_domain` in `terraform.tfvars` and re-run `terraform apply`.
2. Add a CNAME record in your DNS pointing to the SWA's default hostname.
3. Azure will automatically provision a managed TLS certificate.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Service configuration error" | `STORAGE_CONNECTION_STRING` app setting is missing or wrong — re-run the `az staticwebapp appsettings set` command |
| Domain not found | Check that the domain was seeded correctly — run seed script with `--dry-run` to verify parsing |
| Function 500 error | Check SWA Function logs: Azure Portal → Static Web App → Functions → Monitor |
| Deploy fails | Verify all 6 GitHub Secrets are set correctly |
