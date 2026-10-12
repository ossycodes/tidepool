import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { CurrentUser, type AuthUser } from '../common/decorators.js';
import { AiService } from './ai.service.js';
import {
  AnnotationDto,
  AskDto,
  CollectionDto,
  NoteDto,
  StateDto,
} from './dto.js';
import { LibraryService } from './library.service.js';

@Controller('library')
export class LibraryController {
  constructor(
    private readonly library: LibraryService,
    private readonly ai: AiService,
  ) {}
  @Get() list(@CurrentUser() user: AuthUser) {
    return this.library.list(user.id);
  }
  @Post('collections') collection(
    @CurrentUser() user: AuthUser,
    @Body() dto: CollectionDto,
  ) {
    return this.library.createCollection(user.id, dto.name);
  }
  @Delete('collections/:id') @HttpCode(204) deleteCollection(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.library.deleteCollection(user.id, id);
  }
  @Patch('notes/:id') @HttpCode(204) note(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: NoteDto,
  ) {
    return this.library.note(user.id, id, dto.note);
  }
  @Delete('notes/:id') @HttpCode(204) deleteNote(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.library.deleteNote(user.id, id);
  }
  @Get('posts/:id') async read(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return {
      ...(await this.library.read(user.id, id)),
      aiEnabled: this.ai.enabled,
    };
  }
  @Patch('posts/:id') state(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: StateDto,
  ) {
    return this.library.update(user.id, id, dto);
  }
  @Post('posts/:id/extract')
  @HttpCode(202)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  extract(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.library.extract(user.id, id);
  }
  @Post('posts/:id/notes') annotate(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AnnotationDto,
  ) {
    return this.library.annotate(user.id, id, dto);
  }
  @Post('posts/:id/ask')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async ask(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AskDto,
    @Res() res: Response,
  ) {
    const prepared = await this.ai.prepare(user.id, id, dto);
    const abort = new AbortController();
    res.on('close', () => abort.abort());
    if (res.destroyed) abort.abort();
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    const send = (event: string, data: unknown) => {
      if (!res.destroyed)
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    send('thread', prepared.thread);
    try {
      const thread = await this.ai.stream(
        user.id,
        id,
        dto,
        prepared,
        (text) => send('delta', { text }),
        abort.signal,
      );
      send('done', thread);
    } catch {
      send('error', {
        message: 'Could not finish the answer. Please try again.',
      });
    } finally {
      res.end();
    }
  }
}
