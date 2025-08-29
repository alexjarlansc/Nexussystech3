-- Create products table for shared product catalog
CREATE TABLE public.products (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  options text,
  image_url text,
  price numeric(10,2) NOT NULL DEFAULT 0,
  company_id uuid NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- RLS policies for products
-- Users can view products from their company
CREATE POLICY "Users can view company products" 
ON public.products 
FOR SELECT 
USING (company_id IN (
  SELECT profiles.company_id 
  FROM profiles 
  WHERE profiles.user_id = auth.uid()
));

-- Only admins can create products
CREATE POLICY "Admins can create products" 
ON public.products 
FOR INSERT 
WITH CHECK (
  created_by = auth.uid() 
  AND company_id IN (
    SELECT profiles.company_id 
    FROM profiles 
    WHERE profiles.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- Only admins can update products
CREATE POLICY "Admins can update products" 
ON public.products 
FOR UPDATE 
USING (
  company_id IN (
    SELECT profiles.company_id 
    FROM profiles 
    WHERE profiles.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- Only admins can delete products
CREATE POLICY "Admins can delete products" 
ON public.products 
FOR DELETE 
USING (
  company_id IN (
    SELECT profiles.company_id 
    FROM profiles 
    WHERE profiles.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- Create index for better performance
CREATE INDEX idx_products_company_id ON public.products(company_id);

-- Add trigger for updated_at
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();