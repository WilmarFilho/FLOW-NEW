import {
  Body,
  Controller,
  Headers,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProfileService } from './profile.service';
import { UserGuard } from '../common/guards/user.guard';

@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Patch()
  @UseGuards(UserGuard)
  async updateProfile(
    @Headers('x-user-id') userId: string,
    @Body() updateData: any,
  ) {
    return this.profileService.updateProfile(userId, updateData);
  }

  @Post('avatar')
  @UseGuards(UserGuard)
  @UseInterceptors(FileInterceptor('file'))
  async updateAvatar(
    @Headers('x-user-id') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.profileService.updateAvatar(userId, file);
  }
}
