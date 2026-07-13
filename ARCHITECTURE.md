# ARCHITECTURE
 
## Katmanlar
 
UI
 
↓
 
Application
 
↓
 
Finance Engine
 
↓
 
Database
 
---
 
## Kurallar
 
Finance Engine dışında finansal hesaplama yapılmaz.
 
Dashboard hesaplama yapmaz.
 
Kod tekrarından kaçınılır.
 
Aynı iş kuralı iki yerde bulunamaz.
 
SQL iş kuralları TypeScript ile doğrulanmalıdır.
 
---
 
## Finance Engine
 
Finance Engine aşağıdakilerden sorumludur.
 
- Borç
- Kredi
- KMH
- Gelir
- Gider
- Nakit Akışı
- Net Servet
- Finansal Sağlık
- Amortisman
- Erken Kapama