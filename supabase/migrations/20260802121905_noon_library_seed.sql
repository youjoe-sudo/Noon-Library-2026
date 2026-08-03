/*
# Noon Library - Seed Data

## Overview
Inserts default categories, sample books with cover images, and default system settings.

## Data
- 8 categories: literature, science, history, children, religion, philosophy, poetry, self-help
- 16 sample books with real cover images, prices, discounts, stock, flags
- Default settings: shipping rates, commission rate, free shipping threshold, payment accounts, withdrawal threshold, extra shipping for >10 books
*/

-- Categories
INSERT INTO categories (name_ar, name_en, slug, icon, sort_order) VALUES
('أدب','Literature','literature','BookOpen',1),
('علوم','Science','science','Atom',2),
('تاريخ','History','history','Landmark',3),
('أطفال','Children','children','Baby',4),
('دين','Religion','religion','Church',5),
('فلسفة','Philosophy','philosophy','Brain',6),
('شعر','Poetry','poetry','Feather',7),
('تطوير الذات','Self-Help','self-help','Sparkles',8)
ON CONFLICT (slug) DO NOTHING;

-- Books (using Pexels book-cover images)
INSERT INTO books (title, author, publisher, isbn, category_id, price, discount_price, stock, cover_url, description, commission_rate, is_bestseller, is_recommended, is_new_release, is_high_commission) VALUES
('ظلال المدينة','أحمد المرسي','دار النشر الحديث','978-977-1-23456-1', (SELECT id FROM categories WHERE slug='literature'), 180, 145, 25, 'https://images.pexels.com/photos/16186664/pexels-photo-16186664.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'رواية تتناول حياة سكان مدينة عريقة وتأثير الزمن على أحلامهم.', 12, true, true, false, true),
('أسرار الكون','د. سارة فؤاد','دار العلم','978-977-2-34567-2', (SELECT id FROM categories WHERE slug='science'), 220, null, 15, 'https://images.pexels.com/photos/19969897/pexels-photo-19969897.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'موسوعة علمية مبسطة تستكشف أسرار الكون والنجوم.', 15, false, true, true, true),
('ذاكرة الأرض','ليلى حسن','دار التاريخ','978-977-3-45678-3', (SELECT id FROM categories WHERE slug='history'), 150, 120, 30, 'https://images.pexels.com/photos/32166667/pexels-photo-32166667.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'رحلة عبر التاريخ القديم والحضارات المنسية.', 10, true, false, false, false),
('حديقة الأطفال','نور الهدى','دار البراعم','978-977-4-56789-4', (SELECT id FROM categories WHERE slug='children'), 90, 75, 50, 'https://images.pexels.com/photos/30527289/pexels-photo-30527289.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'مجموعة قصص ممتعة للأطفال مليئة بالحكايات والرسوم.', 8, true, true, false, false),
('في رحاب الإيمان','الشيخ عبد الله','دار الهداية','978-977-5-67890-5', (SELECT id FROM categories WHERE slug='religion'), 130, null, 20, 'https://images.pexels.com/photos/9325323/pexels-photo-9325323.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'تأملات روحانية في معاني الإيمان والطمأنينة.', 14, false, false, true, true),
('فلسفة الوجود','د. كريم مصطفى','دار الفكر','978-977-6-78901-6', (SELECT id FROM categories WHERE slug='philosophy'), 200, 160, 12, 'https://images.pexels.com/photos/10495675/pexels-photo-10495675.png?auto=compress&cs=tinysrgb&h=650&w=940', 'دراسة فلسفية عميقة لمعنى الوجود والوعي الإنساني.', 18, false, true, true, true),
('ديوان الحنين','محمود الصوفي','دار الشعر','978-977-7-89012-7', (SELECT id FROM categories WHERE slug='poetry'), 110, 90, 18, 'https://images.pexels.com/photos/12391379/pexels-photo-12391379.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'مجموعة شعرية تتغنى بالحنين والوطن والذكريات.', 12, true, false, false, true),
('طريق النجاح','د. هبة سمير','دار التميز','978-977-8-90123-8', (SELECT id FROM categories WHERE slug='self-help'), 170, 135, 40, 'https://images.pexels.com/photos/29013605/pexels-photo-29013605.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'دليل عملي لتحقيق الأهداف وتطوير الذات والنجاح.', 10, true, true, true, false),
('مدينة الأحلام','يوسف الكاتب','دار الآداب','978-977-9-01234-9', (SELECT id FROM categories WHERE slug='literature'), 195, null, 22, 'https://images.pexels.com/photos/18186540/pexels-photo-18186540.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'رواية عن شاب يبحث عن أحلامه في مدينة كبيرة.', 11, false, false, true, false),
('علم النفس الحديث','د. منى رشاد','دار المعرفة','978-977-1-12345-0', (SELECT id FROM categories WHERE slug='science'), 210, 175, 16, 'https://images.pexels.com/photos/4245021/pexels-photo-4245021.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'مدخل شامل إلى علم النفس الحديث وتطبيقاته.', 13, false, true, false, true),
('حكايات الزمن','سلمى أحمد','دار الأطفال','978-977-2-23456-1', (SELECT id FROM categories WHERE slug='children'), 85, 70, 35, 'https://images.pexels.com/photos/14458893/pexels-photo-14458893.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'قصص شيقة للأطفال عن المغامرات والصداقة.', 9, true, true, true, false),
('مدارس الفكر','د. عمر خالد','دار الفلسفة','978-977-3-34567-2', (SELECT id FROM categories WHERE slug='philosophy'), 185, 150, 10, 'https://images.pexels.com/photos/28530072/pexels-photo-28530072.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'استعراض لأهم المدارس الفلسفية عبر العصور.', 16, false, false, false, true),
('أناشيد الروح','فاطمة الزهراء','دار الإبداع','978-977-4-45678-3', (SELECT id FROM categories WHERE slug='poetry'), 100, null, 20, 'https://images.pexels.com/photos/23833967/pexels-photo-23833967.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'قصائد روحانية تأخذ القارئ في رحلة من الجمال.', 12, false, true, true, false),
('حضارة الأندلس','د. عبد الرحمن طه','دار التاريخ','978-977-5-56789-4', (SELECT id FROM categories WHERE slug='history'), 175, 140, 14, 'https://images.pexels.com/photos/27298425/pexels-photo-27298425.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'دراسة تاريخية شاملة لحضارة الأندلس وتراثها.', 11, true, false, false, true),
('أسرار النجاح','أحمد الزيات','دار الإبداع','978-977-6-67890-5', (SELECT id FROM categories WHERE slug='self-help'), 160, 130, 28, 'https://images.pexels.com/photos/13556546/pexels-photo-13556546.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'مبادئ وقصص ملهمة لتحقيق النجاح في الحياة.', 10, false, true, true, false),
('الكون في حبة رمل','د. سلمى يوسف','دار العلم','978-977-7-78901-6', (SELECT id FROM categories WHERE slug='science'), 230, 190, 8, 'https://images.pexels.com/photos/16186664/pexels-photo-16186664.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'موسوعة مصورة عن الكون والفضاء والكواكب.', 20, false, false, true, true)
ON CONFLICT DO NOTHING;

-- Default settings
INSERT INTO settings (key, value) VALUES
('shipping_cairo_giza','60'),
('shipping_metro','50'),
('shipping_lower_canal','80'),
('shipping_upper','85'),
('shipping_remote','120'),
('shipping_postal','50'),
('shipping_extra_over10','30'),
('free_shipping_threshold','500'),
('default_commission_rate','10'),
('bonus_10_orders_boost','5'),
('bonus_50_orders_boost','10'),
('withdrawal_threshold','100'),
('payment_account_vodafone','01000000000'),
('payment_account_instapay','user@instapay'),
('payment_account_bank','EG12345678901234567890'),
('payment_bank_name','Banque Misr'),
('payment_account_holder','Noon Library')
ON CONFLICT (key) DO NOTHING;