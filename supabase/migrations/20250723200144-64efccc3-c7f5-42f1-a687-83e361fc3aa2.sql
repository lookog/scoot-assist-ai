-- Update keywords for better FAQ matching
UPDATE qa_items 
SET keywords = ARRAY['models', 'types', 'versions', 'variants', 'options', 'scooters', 'products', 'differences', 'compare', 'comparison', 'specs', 'features', 'different']
WHERE question LIKE '%key differences%' OR question LIKE '%scooter models%';

-- Update other FAQ items with better keywords for improved matching
UPDATE qa_items 
SET keywords = ARRAY['speed', 'range', 'maximum', 'mph', 'distance', 'miles', 'fast', 'battery', 'performance']
WHERE question LIKE '%maximum speed%' OR question LIKE '%range%';

UPDATE qa_items 
SET keywords = ARRAY['return', 'refund', 'exchange', 'policy', 'send back', 'money back', 'replacement']
WHERE question LIKE '%return policy%';

UPDATE qa_items 
SET keywords = ARRAY['warranty', 'guarantee', 'coverage', 'protection', 'repair', 'covered', 'duration']
WHERE question LIKE '%warranty%';

UPDATE qa_items 
SET keywords = ARRAY['service', 'repair', 'maintenance', 'fix', 'support', 'technician', 'location']
WHERE question LIKE '%serviced%' OR question LIKE '%service%';

UPDATE qa_items 
SET keywords = ARRAY['track', 'order', 'delivery', 'address', 'shipping', 'status', 'location', 'change']
WHERE question LIKE '%track%' OR question LIKE '%order%' OR question LIKE '%delivery%';

UPDATE qa_items 
SET keywords = ARRAY['waterproof', 'water', 'rain', 'weather', 'wet', 'resistant', 'protection']
WHERE question LIKE '%waterproof%' OR question LIKE '%water%';

UPDATE qa_items 
SET keywords = ARRAY['legal', 'street', 'road', 'law', 'regulations', 'permitted', 'ride', 'allowed']
WHERE question LIKE '%street legal%' OR question LIKE '%ride%' OR question LIKE '%legal%';

UPDATE qa_items 
SET keywords = ARRAY['accessories', 'parts', 'add-ons', 'extras', 'components', 'available']
WHERE question LIKE '%accessories%';

UPDATE qa_items 
SET keywords = ARRAY['payment', 'pay', 'cost', 'price', 'billing', 'methods', 'accept', 'credit card']
WHERE question LIKE '%payment%' OR question LIKE '%pay%';