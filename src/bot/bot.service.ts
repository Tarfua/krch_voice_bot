import { Injectable } from '@nestjs/common';
import { Ctx, On, Start, Update, Action } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { Message } from 'typegram';
import { VoiceService } from '../voice/voice.service';
import { InlineQueryResult } from 'telegraf/typings/core/types/typegram';
import { ConfigService } from '@nestjs/config';

interface BotContext extends Context {
  session: {
    waitingForVoice?: boolean;
    waitingForCaption?: boolean;
    lastMessageId?: number;
    lastVoiceFileId?: string; // Додаємо поле для збереження file_id
  };
}

@Injectable()
@Update()
export class BotService {
  private readonly channelId: string;

  constructor(
    private readonly voiceService: VoiceService,
    private readonly configService: ConfigService,
  ) {
    this.channelId = this.configService.get<string>('CHANNEL_ID');
  }

  private initSession(ctx: BotContext) {
    if (!ctx.session) {
      ctx.session = {
        waitingForVoice: false,
        waitingForCaption: false,
        lastMessageId: undefined,
        lastVoiceFileId: undefined,
      };
    }
  }

  @Start()
  async start(@Ctx() ctx: BotContext) {
    this.initSession(ctx);
    await ctx.reply(
      'Вітаю! Я бот для збору голосових цитат. Натисніть кнопку нижче, щоб додати нову цитату.',
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: 'Додати цитату',
                callback_data: 'add_quote',
              },
            ],
          ],
        },
      },
    );
  }

  @Action('add_quote')
  async onAddQuote(@Ctx() ctx: BotContext) {
    this.initSession(ctx);
    ctx.session.waitingForVoice = true;
    await ctx.reply(
      'Будь ласка, надішліть голосове повідомлення, яке ви хочете додати як цитату.',
    );
  }

  @Action('finish')
  async onFinish(@Ctx() ctx: BotContext) {
    this.initSession(ctx);
    ctx.session = {
      waitingForVoice: false,
      waitingForCaption: false,
      lastMessageId: undefined,
      lastVoiceFileId: undefined,
    };
    await ctx.reply('Щоб почати знову, натисніть /start');
  }

  @On('voice')
  async onVoiceMessage(@Ctx() ctx: BotContext) {
    this.initSession(ctx);
    if (!ctx.session.waitingForVoice) {
      await ctx.reply('Спочатку натисніть кнопку "Додати цитату".');
      return;
    }

    try {
      const voice = (ctx.message as Message.VoiceMessage).voice;

      // Пересилаємо повідомлення в канал
      const sentMessage = await ctx.telegram.sendVoice(
        this.channelId,
        voice.file_id,
      );

      // Зберігаємо ID повідомлення та file_id в сесії
      ctx.session.lastMessageId = sentMessage.message_id;
      ctx.session.lastVoiceFileId = voice.file_id; // Зберігаємо file_id в сесії

      ctx.session.waitingForVoice = false;
      ctx.session.waitingForCaption = true;

      await ctx.reply('Чудово! Тепер додайте підпис до цієї голосової цитати.');
    } catch (error) {
      console.error('Error handling voice message:', error);
      await ctx.reply(
        'Виникла помилка при обробці голосового повідомлення. Спробуйте ще раз.',
      );
    }
  }

  @On('text')
  async onTextMessage(@Ctx() ctx: BotContext) {
    this.initSession(ctx);
    if (!ctx.session.waitingForCaption || !ctx.session.lastMessageId) {
      return;
    }

    try {
      const caption = (ctx.message as Message.TextMessage).text;

      // Отримуємо fileId з сесії
      const fileId = ctx.session.lastVoiceFileId; // Використовуємо file_id з сесії

      // Редагуємо повідомлення в каналі, додаючи підпис
      await ctx.telegram.editMessageCaption(
        this.channelId,
        ctx.session.lastMessageId,
        undefined,
        caption,
      );

      // Зберігаємо голосове повідомлення в базі даних після отримання підпису
      await this.voiceService.addVoice(fileId, caption);

      // Скидаємо стан сесії
      ctx.session.waitingForCaption = false;
      ctx.session.lastMessageId = undefined;
      ctx.session.lastVoiceFileId = undefined;

      await ctx.reply(
        'Цитату успішно додано до каналу та збережено! Що бажаєте зробити далі?',
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: 'Додати ще цитату',
                  callback_data: 'add_quote',
                },
                {
                  text: 'Завершити роботу',
                  callback_data: 'finish',
                },
              ],
            ],
          },
        },
      );
    } catch (error) {
      console.error('Error handling text message:', error);
      await ctx.reply(
        'Виникла помилка при додаванні підпису. Спробуйте ще раз.',
      );
    }
  }

  @On('inline_query')
  async onInlineQuery(@Ctx() ctx: BotContext) {
    const query = ctx.inlineQuery?.query || '';

    try {
      const voices = await this.voiceService.searchVoices(query);

      const results: InlineQueryResult[] = voices.map((voice, index) => ({
        type: 'voice',
        id: String(index),
        voice_file_id: voice.fileId,
        title: voice.title,
        caption: voice.title,
      }));

      // Відправляємо результати запиту
      await ctx.answerInlineQuery(results, {
        cache_time: 0,
        is_personal: true,
      });
    } catch (error) {
      console.error('Error handling inline query:', error);
      await ctx.answerInlineQuery([], {
        cache_time: 0,
      });
    }
  }
}
