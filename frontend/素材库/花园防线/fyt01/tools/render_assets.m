#import <AppKit/AppKit.h>
#import <ImageIO/ImageIO.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>

static CGImageRef CreateImage(NSString *path, NSInteger width, NSInteger height, BOOL previewBackground) {
  NSURL *inputURL = [NSURL fileURLWithPath:path];
  CGImageSourceRef sourceRef = CGImageSourceCreateWithURL((__bridge CFURLRef)inputURL, NULL);
  if (!sourceRef) {
    fprintf(stderr, "Unable to load image: %s\n", path.UTF8String);
    return NULL;
  }
  CGImageRef source = CGImageSourceCreateImageAtIndex(sourceRef, 0, NULL);
  CFRelease(sourceRef);
  if (!source) return NULL;
  CGColorSpaceRef colorSpace = CGColorSpaceCreateDeviceRGB();
  CGContextRef context = CGBitmapContextCreate(
      NULL, width, height, 8, 0, colorSpace,
      kCGImageAlphaPremultipliedLast | kCGBitmapByteOrder32Big);
  CGColorSpaceRelease(colorSpace);
  if (!context) {
    CGImageRelease(source);
    return NULL;
  }
  CGContextSetInterpolationQuality(context, kCGInterpolationHigh);
  if (previewBackground) {
    CGContextSetRGBFillColor(context, 0.075, 0.086, 0.11, 1);
    CGContextFillRect(context, CGRectMake(0, 0, width, height));
  } else {
    CGContextClearRect(context, CGRectMake(0, 0, width, height));
  }
  CGContextDrawImage(context, CGRectMake(0, 0, width, height), source);
  CGImageRelease(source);
  CGImageRef image = CGBitmapContextCreateImage(context);
  CGContextRelease(context);
  return image;
}

static BOOL WritePNG(NSString *input, NSString *output, NSInteger width, NSInteger height) {
  CGImageRef image = CreateImage(input, width, height, NO);
  if (!image) return NO;
  NSURL *url = [NSURL fileURLWithPath:output];
  CGImageDestinationRef destination = CGImageDestinationCreateWithURL(
      (__bridge CFURLRef)url, (__bridge CFStringRef)UTTypePNG.identifier, 1, NULL);
  if (!destination) {
    CGImageRelease(image);
    return NO;
  }
  CGImageDestinationAddImage(destination, image, NULL);
  BOOL ok = CGImageDestinationFinalize(destination);
  CFRelease(destination);
  CGImageRelease(image);
  return ok;
}

static BOOL CropPNG(NSString *input, NSString *output, NSInteger x, NSInteger y,
                    NSInteger width, NSInteger height) {
  NSURL *inputURL = [NSURL fileURLWithPath:input];
  CGImageSourceRef source = CGImageSourceCreateWithURL((__bridge CFURLRef)inputURL, NULL);
  if (!source) return NO;
  CGImageRef image = CGImageSourceCreateImageAtIndex(source, 0, NULL);
  CFRelease(source);
  if (!image) return NO;

  CGRect rect = CGRectMake(x, y, width, height);
  CGImageRef cropped = CGImageCreateWithImageInRect(image, rect);
  CGImageRelease(image);
  if (!cropped) return NO;

  NSURL *outputURL = [NSURL fileURLWithPath:output];
  CGImageDestinationRef destination = CGImageDestinationCreateWithURL(
      (__bridge CFURLRef)outputURL, (__bridge CFStringRef)UTTypePNG.identifier, 1, NULL);
  if (!destination) {
    CGImageRelease(cropped);
    return NO;
  }
  CGImageDestinationAddImage(destination, cropped, NULL);
  BOOL ok = CGImageDestinationFinalize(destination);
  CFRelease(destination);
  CGImageRelease(cropped);
  return ok;
}

static BOOL WriteGIF(NSString *output, NSInteger width, NSInteger height,
                     double delay, NSArray<NSString *> *frames) {
  NSURL *url = [NSURL fileURLWithPath:output];
  CGImageDestinationRef destination = CGImageDestinationCreateWithURL(
      (__bridge CFURLRef)url, (__bridge CFStringRef)UTTypeGIF.identifier,
      frames.count, NULL);
  if (!destination) return NO;

  NSDictionary *globalProps = @{
    (__bridge NSString *)kCGImagePropertyGIFDictionary: @{
      (__bridge NSString *)kCGImagePropertyGIFLoopCount: @0
    }
  };
  CGImageDestinationSetProperties(destination, (__bridge CFDictionaryRef)globalProps);
  NSDictionary *frameProps = @{
    (__bridge NSString *)kCGImagePropertyGIFDictionary: @{
      (__bridge NSString *)kCGImagePropertyGIFDelayTime: @(delay),
      (__bridge NSString *)kCGImagePropertyGIFUnclampedDelayTime: @(delay)
    }
  };

  for (NSString *frame in frames) {
    CGImageRef image = CreateImage(frame, width, height, YES);
    if (!image) {
      CFRelease(destination);
      return NO;
    }
    CGImageDestinationAddImage(destination, image, (__bridge CFDictionaryRef)frameProps);
    CGImageRelease(image);
  }
  BOOL ok = CGImageDestinationFinalize(destination);
  CFRelease(destination);
  return ok;
}

static BOOL PrintGIFInfo(NSString *input) {
  NSURL *url = [NSURL fileURLWithPath:input];
  CGImageSourceRef source = CGImageSourceCreateWithURL((__bridge CFURLRef)url, NULL);
  if (!source) return NO;
  size_t count = CGImageSourceGetCount(source);
  double duration = 0;
  for (size_t index = 0; index < count; index++) {
    CFDictionaryRef properties = CGImageSourceCopyPropertiesAtIndex(source, index, NULL);
    NSDictionary *gif = [(__bridge NSDictionary *)properties objectForKey:(__bridge NSString *)kCGImagePropertyGIFDictionary];
    NSNumber *delay = gif[(__bridge NSString *)kCGImagePropertyGIFUnclampedDelayTime];
    if (!delay || delay.doubleValue <= 0) {
      delay = gif[(__bridge NSString *)kCGImagePropertyGIFDelayTime];
    }
    duration += delay.doubleValue;
    if (properties) CFRelease(properties);
  }
  CFRelease(source);
  printf("frames=%zu duration=%.2fs\n", count, duration);
  return YES;
}

int main(int argc, const char *argv[]) {
  @autoreleasepool {
    if (argc < 2) {
      fprintf(stderr, "Usage: render_assets png INPUT OUTPUT SIZE | crop INPUT OUTPUT X Y W H | gif OUTPUT SIZE DELAY FRAME... | gif-info INPUT\n");
      return 2;
    }
    NSString *command = [NSString stringWithUTF8String:argv[1]];
    if ([command isEqualToString:@"png"] && argc == 5) {
      NSString *input = [NSString stringWithUTF8String:argv[2]];
      NSString *output = [NSString stringWithUTF8String:argv[3]];
      NSInteger size = [[NSString stringWithUTF8String:argv[4]] integerValue];
      return WritePNG(input, output, size, size) ? 0 : 1;
    }
    if ([command isEqualToString:@"crop"] && argc == 8) {
      NSString *input = [NSString stringWithUTF8String:argv[2]];
      NSString *output = [NSString stringWithUTF8String:argv[3]];
      NSInteger x = [[NSString stringWithUTF8String:argv[4]] integerValue];
      NSInteger y = [[NSString stringWithUTF8String:argv[5]] integerValue];
      NSInteger width = [[NSString stringWithUTF8String:argv[6]] integerValue];
      NSInteger height = [[NSString stringWithUTF8String:argv[7]] integerValue];
      return CropPNG(input, output, x, y, width, height) ? 0 : 1;
    }
    if ([command isEqualToString:@"gif"] && argc >= 7) {
      NSString *output = [NSString stringWithUTF8String:argv[2]];
      NSInteger size = [[NSString stringWithUTF8String:argv[3]] integerValue];
      double delay = [[NSString stringWithUTF8String:argv[4]] doubleValue];
      NSMutableArray<NSString *> *frames = [NSMutableArray array];
      for (int index = 5; index < argc; index++) {
        [frames addObject:[NSString stringWithUTF8String:argv[index]]];
      }
      return WriteGIF(output, size, size, delay, frames) ? 0 : 1;
    }
    if ([command isEqualToString:@"gif-info"] && argc == 3) {
      return PrintGIFInfo([NSString stringWithUTF8String:argv[2]]) ? 0 : 1;
    }
    fprintf(stderr, "Invalid arguments.\n");
    return 2;
  }
}
