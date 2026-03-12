
-- Create enum types
CREATE TYPE public.user_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.app_role AS ENUM ('admin', 'normal');
CREATE TYPE public.client_status AS ENUM ('activo', 'inactivo');
CREATE TYPE public.dias_tipo AS ENUM ('naturales', 'habiles');
CREATE TYPE public.invoice_status AS ENUM ('vigente', 'vencida', 'pagada', 'abono_parcial');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  status user_status NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Security definer function to get user status
CREATE OR REPLACE FUNCTION public.get_user_status(_user_id UUID)
RETURNS user_status
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT status FROM public.profiles WHERE id = _user_id
$$;

-- Profiles RLS policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update profiles"
  ON public.profiles FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update own profile name"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- User roles RLS policies
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create clients table
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(6) NOT NULL UNIQUE,
  nombre VARCHAR(200) NOT NULL,
  dias_credito INT NOT NULL DEFAULT 45,
  tipo_dias dias_tipo NOT NULL DEFAULT 'naturales',
  limite_credito DECIMAL(15,2) NOT NULL DEFAULT 0,
  estado client_status NOT NULL DEFAULT 'activo',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_clients_nombre ON public.clients(nombre);
CREATE INDEX idx_clients_estado ON public.clients(estado);

CREATE POLICY "Approved users can view clients"
  ON public.clients FOR SELECT
  TO authenticated
  USING (public.get_user_status(auth.uid()) = 'approved' OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Approved users can insert clients"
  ON public.clients FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_status(auth.uid()) = 'approved' OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Approved users can update clients"
  ON public.clients FOR UPDATE
  TO authenticated
  USING (public.get_user_status(auth.uid()) = 'approved' OR public.has_role(auth.uid(), 'admin'));

-- Create invoices table
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_codigo VARCHAR(6) NOT NULL REFERENCES public.clients(codigo),
  cuenta VARCHAR(50),
  reference VARCHAR(100) NOT NULL UNIQUE,
  fecha_emision DATE,
  pedimento VARCHAR(50),
  honorarios DECIMAL(15,2) DEFAULT 0,
  total_factura DECIMAL(15,2) DEFAULT 0,
  anticipos DECIMAL(15,2) DEFAULT 0,
  saldo DECIMAL(15,2) DEFAULT 0,
  cobranza DECIMAL(15,2) DEFAULT 0,
  por_cobrar DECIMAL(15,2) DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  status invoice_status NOT NULL DEFAULT 'vigente',
  paid_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_invoices_cliente_active ON public.invoices(cliente_codigo, active);
CREATE INDEX idx_invoices_status_active ON public.invoices(status, active);
CREATE INDEX idx_invoices_fecha ON public.invoices(fecha_emision);

CREATE POLICY "Approved users can view invoices"
  ON public.invoices FOR SELECT
  TO authenticated
  USING (public.get_user_status(auth.uid()) = 'approved' OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Approved users can insert invoices"
  ON public.invoices FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_status(auth.uid()) = 'approved' OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Approved users can update invoices"
  ON public.invoices FOR UPDATE
  TO authenticated
  USING (public.get_user_status(auth.uid()) = 'approved' OR public.has_role(auth.uid(), 'admin'));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
