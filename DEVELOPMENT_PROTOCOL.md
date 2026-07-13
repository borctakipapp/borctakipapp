# DEVELOPMENT PROTOCOL
 
Bu dosya bu proje için zorunlu çalışma protokolüdür.
 
---
 
# Yeni Sohbet
 
Her yeni sohbet başladığında otomatik olarak:
 
1. PROJECT_CONTEXT.md oku.
2. CURRENT_STATE.md oku.
3. ARCHITECTURE.md oku.
4. TECHNICAL_DEBT.md oku.
5. AI_WORKFLOW.md oku.
Ardından GitHub kod tabanını analiz et.
 
Kod ile doküman senkron değilse önce dokümanları güncelle.
 
---
 
# Kod Yazmadan Önce
 
Her zaman şu sırayı uygula.
 
1. Analiz
2. Mimari değerlendirme
3. Veri modeli değerlendirmesi
4. Çözüm planı
5. Kullanıcı onayı
6. Kodlama
---
 
# Geliştirme Kuralları
 
- Kod tekrarı oluşturma.
- Finance Engine dışında finansal hesaplama oluşturma.
- Mevcut mimariyi bozma.
- Gereksiz refactor yapma.
- Geçici çözüm üretme.
---
 
# Yeni Özellik
 
Yeni özellik eklemeden önce:
 
Mevcut veri modeli yeterli mi?
 
değerlendir.
 
Değilse önce veri modelini iyileştir.
 
---
 
# Kod Tamamlandıktan Sonra
 
Kodu tekrar incele.
 
Software Architect
 
Code Reviewer
 
Product Owner
 
bakış açısıyla değerlendir.
 
---
 
# EXIT CRITERIA
 
Bir geliştirme aşağıdaki maddeler tamamlanmadan bitmiş sayılmaz.
 
☐ Kod tamamlandı
 
☐ Self Code Review yapıldı
 
☐ Faz Raporu oluşturuldu
 
☐ CURRENT_STATE.md güncellendi
 
☐ TECHNICAL_DEBT.md güncellendi
 
☐ ARCHITECTURE.md kontrol edildi
 
☐ SQL migration kontrol edildi
 
☐ Kod ile dokümantasyon senkron doğrulandı
 
---
 
# Öncelik Sırası
 
1. Finansal doğruluk
2. Mimari bütünlük
3. Veri modeli
4. Test edilebilirlik
5. Güvenlik
6. Performans
7. Kullanıcı deneyimi
8. Yeni özellik
Bu sıra değiştirilemez.