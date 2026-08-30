import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  STREAM_CLIP_EXPORT_QUEUE,
  StreamClipExportJob,
} from './stream-clip-export.constants';
import { StreamClipExportService } from './stream-clip-export.service';

@Processor(STREAM_CLIP_EXPORT_QUEUE)
export class StreamClipExportWorker extends WorkerHost {
  private readonly logger = new Logger(StreamClipExportWorker.name);

  constructor(private readonly exportService: StreamClipExportService) {
    super();
  }

  async process(job: Job<StreamClipExportJob>): Promise<void> {
    const { clipId } = job.data;
    this.logger.debug(`Exporting stream clip ${clipId}`);
    await this.exportService.exportClip(clipId);
  }
}
