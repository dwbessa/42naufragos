import { Router } from "express";
import { completeVerification, VerificationError } from "../../services/verificationService.js";

export const callbackRouter = Router();

function page(title: string, message: string): string {
  return `<!doctype html>
<html lang="pt-br">
<head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family: sans-serif; max-width: 480px; margin: 80px auto; text-align: center;">
  <h1>${title}</h1>
  <p>${message}</p>
  <p>Pode fechar essa aba e voltar pro Discord.</p>
</body>
</html>`;
}

callbackRouter.get("/oauth/callback", async (req, res) => {
  const { code, state } = req.query;

  if (typeof code !== "string" || typeof state !== "string") {
    res.status(400).send(page("Requisição inválida", "Faltam parâmetros na URL."));
    return;
  }

  try {
    const { login } = await completeVerification(code, state);
    res.status(200).send(page("Verificado!", `Bem-vindo, ${login}. Seu acesso foi liberado.`));
  } catch (error) {
    if (error instanceof VerificationError) {
      res.status(400).send(page("Não foi possível verificar", error.message));
      return;
    }
    console.error("Erro inesperado no callback OAuth:", error);
    res.status(500).send(page("Erro interno", "Algo deu errado. Tenta rodar /verify de novo."));
  }
});
