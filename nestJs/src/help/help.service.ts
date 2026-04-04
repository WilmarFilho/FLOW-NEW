import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class HelpService {
  private readonly openai: OpenAI;
  private readonly knowledgePath = path.join(__dirname, 'knowledge_base.txt');

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.openai = new OpenAI({ apiKey });
  }

  async askQuestion(userId: string, question: string) {
    try {
      // 1. Read Knowledge Base
      let context = '';
      if (fs.existsSync(this.knowledgePath)) {
        context = fs.readFileSync(this.knowledgePath, 'utf-8');
      } else {
        // Fallback to local path if __dirname is different in dev/prod
        const localPath = path.join(process.cwd(), 'src', 'help', 'knowledge_base.txt');
        if (fs.existsSync(localPath)) {
          context = fs.readFileSync(localPath, 'utf-8');
        }
      }

      // 2. Call OpenAI
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini', // Efficient for help desk
        messages: [
          {
            role: 'system',
            content: `Você é o Suporte do FLOW, uma plataforma de gestão de WhatsApp. 
            Use o seguinte conteúdo como sua única fonte de verdade para responder as dúvidas do usuário. 
            Se a resposta não estiver no texto, diga educadamente que não sabe e sugira falar com o Suporte Humano.
            Mantenha suas respostas concisas, profissionais e amigáveis.
            
            CONTEÚDO DE SUPORTE:
            ${context}`
          },
          {
            role: 'user',
            content: question
          }
        ],
        temperature: 0.3,
        max_tokens: 500,
      });

      return {
        answer: response.choices[0].message.content,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Erro no HelpService:', error);
      throw new HttpException('Erro ao processar sua dúvida.', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
