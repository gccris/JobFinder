import Link from "next/link";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth();

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600">JobHub</h1>
          <div className="flex gap-4">
            {session?.user ? (
              <>
                <Link
                  href="/jobs"
                  className="text-gray-700 hover:text-gray-900"
                >
                  Vagas
                </Link>
                <Link
                  href="/dashboard"
                  className="text-gray-700 hover:text-gray-900"
                >
                  Minhas Vagas
                </Link>
                {(session.user as any)?.role === "ADMIN" && (
                  <Link
                    href="/admin"
                    className="text-gray-700 hover:text-gray-900"
                  >
                    Admin
                  </Link>
                )}
                <form
                  action={async () => {
                    "use server";
                    const { signOut } = await import("@/lib/auth");
                    await signOut();
                  }}
                >
                  <button
                    type="submit"
                    className="text-gray-700 hover:text-gray-900"
                  >
                    Sair
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-gray-700 hover:text-gray-900"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  Cadastro
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h2 className="text-4xl font-bold text-gray-900 mb-4">
          Encontre sua próxima oportunidade em Tech
        </h2>
        <p className="text-xl text-gray-600 mb-8">
          Agregamos os melhores anúncios de emprego em tecnologia de múltiplas plataformas
        </p>

        {session?.user ? (
          <Link
            href="/jobs"
            className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 text-lg font-semibold"
          >
            Explorar Vagas
          </Link>
        ) : (
          <div className="flex gap-4 justify-center">
            <Link
              href="/login"
              className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 text-lg font-semibold"
            >
              Começar Agora
            </Link>
            <Link
              href="/register"
              className="inline-block border border-blue-600 text-blue-600 px-8 py-3 rounded-lg hover:bg-blue-50 text-lg font-semibold"
            >
              Cadastro
            </Link>
          </div>
        )}
      </div>

      {/* Features */}
      <div className="bg-blue-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-3xl font-bold text-center mb-12">
            Por que usar JobHub?
          </h3>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-lg shadow-sm">
              <h4 className="text-xl font-bold mb-4">Agregação</h4>
              <p className="text-gray-600">
                Vagas de LinkedIn, Indeed e muito mais em um único lugar.
              </p>
            </div>
            <div className="bg-white p-8 rounded-lg shadow-sm">
              <h4 className="text-xl font-bold mb-4">Filtros</h4>
              <p className="text-gray-600">
                Encontre exatamente o que procura com filtros avançados.
              </p>
            </div>
            <div className="bg-white p-8 rounded-lg shadow-sm">
              <h4 className="text-xl font-bold mb-4">Salve Vagas</h4>
              <p className="text-gray-600">
                Guarde suas vagas favoritas para consultar depois.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
