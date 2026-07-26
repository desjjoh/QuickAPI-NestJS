import { DataSource } from 'typeorm';
import { ImageEntity } from '../entities/image.entity';
import { ImageRepository } from './image.repository';

describe('ImageRepository behavior', () => {
  const dataSource = {
    createEntityManager: jest.fn().mockReturnValue({}),
  } as unknown as DataSource;

  it('normalizes alt text, saves, and reloads the created row', async () => {
    const repo = new ImageRepository(dataSource);
    const image = { id: 'image-id', alt_text: null } as ImageEntity;
    jest.spyOn(repo, 'create').mockReturnValue(image);
    jest.spyOn(repo, 'save').mockResolvedValue(image);
    jest.spyOn(repo, 'findOneByOrFail').mockResolvedValue(image);
    await expect(repo.createImage({ filename: 'a.png' })).resolves.toBe(image);
    expect(repo.create).toHaveBeenCalledWith({
      filename: 'a.png',
      alt_text: null,
    });
    expect(repo.findOneByOrFail).toHaveBeenCalledWith({ id: 'image-id' });
  });

  it('omits undefined values when merging an update', async () => {
    const repo = new ImageRepository(dataSource);
    const image = { id: '1', alt_text: 'old' } as ImageEntity;
    jest.spyOn(repo, 'merge').mockReturnValue(image);
    jest.spyOn(repo, 'save').mockResolvedValue(image);
    await repo.updateImage(image, { alt_text: undefined, filename: 'new.png' });
    expect(repo.merge).toHaveBeenCalledWith(image, { filename: 'new.png' });
  });

  it('orders newest images first', async () => {
    const repo = new ImageRepository(dataSource);
    jest.spyOn(repo, 'find').mockResolvedValue([]);
    await repo.findAll();
    expect(repo.find).toHaveBeenCalledWith({ order: { createdAt: 'DESC' } });
  });
});
