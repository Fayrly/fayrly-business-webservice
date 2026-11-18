import { CommonModule, DOCUMENT } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { forkJoin } from 'rxjs';
import { EventService } from '../../core/api/event.service';
import { ReviewService } from '../../core/api/review.service';

interface FeatureCard {
  image: string;
  title: string;
  desc: string;
  posterTitle: string;
  details: string[];
}

interface StatTargets {
  events: number;
  cities: number;
  going: number;
  reviews: number;
}

const COUNT_UP_MS = 900;
const AVATAR_COLORS = ['bg-mint-700', 'bg-crimson-500', 'bg-mint-500', 'bg-mint-900'];

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink, LucideAngularModule],
  templateUrl: './landing.html',
  styleUrl: './landing.css',
})
export class LandingPage implements AfterViewInit, OnDestroy {
  private readonly events = inject(EventService);
  private readonly reviews = inject(ReviewService);
  private readonly document = inject(DOCUMENT);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);
  private previousOverflow = '';
  private cleanupParallax?: () => void;

  @ViewChild('statsSection') private statsSection?: ElementRef<HTMLElement>;
  @ViewChild('featureDialog') private featureDialog!: ElementRef<HTMLDialogElement>;
  @ViewChild('featurePills') private featurePills!: ElementRef<HTMLElement>;

  protected readonly selectedFeature = signal<FeatureCard | null>(null);

  protected readonly covers = signal<string[]>([]);
  protected readonly reviewers = signal<string[]>([]);
  protected readonly extraReviewers = signal(0);
  protected readonly targets = signal<StatTargets>({
    events: 0,
    cities: 0,
    going: 0,
    reviews: 0,
  });
  protected readonly displayed = signal<StatTargets>({
    events: 0,
    cities: 0,
    going: 0,
    reviews: 0,
  });
  protected readonly menuOpen = signal(false);
  protected readonly organizers = [
    { name: 'Pestapora', image: 'pestapora.png', width: 1055, height: 220, compact: false },
    { name: 'The Sounds Project', image: 'the-sounds-project.png', width: 631, height: 335, compact: false },
    { name: 'Ancol', image: 'ancol.png', width: 1000, height: 325, compact: false },
    { name: 'Zodiac', image: 'zodiac.png', width: 1183, height: 247, compact: false },
    { name: 'Logo organizer dengan monogram', image: 'organizer-05.png', width: 420, height: 466, compact: true },
    { name: 'Logo organizer dengan simbol lingkaran', image: 'organizer-06.png', width: 800, height: 718, compact: true },
  ];

  protected readonly features: FeatureCard[] = [
    {
      image: 'overview.jpg',
      title: 'Ringkasan Bisnis',
      posterTitle: 'Lihat gambaran besarnya.',
      desc: 'Satu pandangan untuk memahami aktivitas dan performa eventmu.',
      details: ['Pantau event aktif, draf, kapasitas terjadwal, rating, dan jumlah ulasan.', 'Temukan pengingat draf, agenda tujuh hari ke depan, dan laporan yang menunggu tinjauan.'],
    },
    {
      image: 'events.jpg',
      title: 'Kelola Event',
      posterTitle: 'Panggung milikmu.',
      desc: 'Susun katalog dan kelola perjalanan event dari draf sampai selesai.',
      details: ['Cari event berdasarkan judul dan saring katalog berdasarkan status.', 'Terbitkan, mulai, selesaikan, atau batalkan event sesuai status dan izin akun.'],
    },
    {
      image: 'create.jpg',
      title: 'Buat & Ubah Event',
      posterTitle: 'Ide jadi nyata.',
      desc: 'Siapkan detail event melalui formulir bertahap yang mudah diikuti.',
      details: ['Lengkapi sampul, deskripsi, lokasi, jadwal, kapasitas, dan rentang harga tiket.', 'Periksa pratinjau sebelum menyimpan draf atau menerbitkan event.'],
    },
    {
      image: 'schedule.jpg',
      title: 'Jadwal',
      posterTitle: 'Setiap momen, terencana.',
      desc: 'Lihat agenda event agar persiapan tetap berjalan sesuai rencana.',
      details: ['Jelajahi agenda bulanan dalam WIB, dengan filter mendatang, sudah lewat, atau semua.', 'Pantau jumlah event dalam tujuh dan 30 hari ke depan.'],
    },
    {
      image: 'tickets.jpg',
      title: 'Harga & Promo',
      posterTitle: 'Harga yang pas.',
      desc: 'Pantau harga event dan tentukan pilihan yang sesuai untuk audiensmu.',
      details: ['Lihat ringkasan event gratis dan berbayar beserta harga terendah dan tertinggi.', 'Ubah harga melalui langkah Tiket pada formulir event. Pengelolaan promo dan voucher belum tersedia.'],
    },
    {
      image: 'reviews.jpg',
      title: 'Ulasan',
      posterTitle: 'Dengar cerita mereka.',
      desc: 'Jadikan pengalaman peserta sebagai masukan untuk event berikutnya.',
      details: ['Lihat rating rata-rata dan jumlah ulasan pada event yang dipilih.', 'Baca komentar, rating, tanggal, dan foto yang dibagikan peserta.'],
    },
    {
      image: 'reports.jpg',
      title: 'Laporan',
      posterTitle: 'Cerita di balik event.',
      desc: 'Rangkum hasil kegiatan dan kelola proses tinjauan laporan.',
      details: ['Buat draf laporan dengan periode, ringkasan, dan metrik kegiatan.', 'Kirim laporan untuk ditinjau; persetujuan atau penolakan mengikuti izin peninjau.'],
    },
    {
      image: 'security.jpg',
      title: 'Akun & Keamanan',
      posterTitle: 'Tetap dalam kendali.',
      desc: 'Kenali akses akunmu dan jaga keamanan saat mengelola event.',
      details: ['Lihat profil, status akun, peran, serta daftar izin yang dimiliki.', 'Ubah kata sandi dan keluar dari dashboard dengan mudah.'],
    },
  ];

  protected readonly featureRows = [
    this.features.slice(0, 2),
    this.features.slice(2, 4),
    this.features.slice(4, 6),
    this.features.slice(6, 8),
  ];

  protected readonly steps = [
    {
      no: '01',
      title: 'Daftar & masuk',
      desc: 'Buat akun penyelenggara dan masuk ke dashboard Fayrly.',
    },
    {
      no: '02',
      title: 'Buat event pertamamu',
      desc: 'Isi detail event: sampul, lokasi, jadwal, kapasitas, dan harga.',
    },
    {
      no: '03',
      title: 'Terbitkan & pantau',
      desc: 'Event tayang ke publik dan statistiknya terpantau langsung.',
    },
  ];

  private observer?: IntersectionObserver;
  private dataReady = false;
  private sectionVisible = false;
  private animated = false;

  constructor() {
    forkJoin({
      events: this.events.listPublic({ page: 1, pageSize: 100 }),
      reviews: this.reviews.listPublic(1, 100),
    }).subscribe({
      next: ({ events, reviews }) => {
        const live = events.data.filter(
          (e) => e.status === 'published' || e.status === 'ongoing',
        );
        this.covers.set(
          [
            ...new Set(
              live
                .map((e) => e.cover_image_url)
                .filter((url): url is string => Boolean(url)),
            ),
          ].slice(0, 5),
        );
        const uniqueReviewers = [
          ...new Set(reviews.data.map((r) => r.user_name).filter(Boolean)),
        ];
        this.reviewers.set(uniqueReviewers.slice(0, 2));
        this.extraReviewers.set(Math.max(0, uniqueReviewers.length - 2));
        this.targets.set({
          events: live.length,
          cities: new Set(live.map((e) => e.city).filter(Boolean)).size,
          going: live.reduce((sum, e) => sum + (e.going_count || 0), 0),
          reviews: reviews.pagination.total,
        });
        this.dataReady = true;
        this.maybeAnimate();
      },
      error: () => {
        this.dataReady = true;
      },
    });
  }

  ngAfterViewInit(): void {
    const el = this.statsSection?.nativeElement;
    if (!el) return;
    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          this.sectionVisible = true;
          this.maybeAnimate();
          this.observer?.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    this.observer.observe(el);
    this.zone.runOutsideAngular(() => {
      const pills = this.featurePills.nativeElement;
      const media = window.matchMedia('(max-width: 767px) and (prefers-reduced-motion: no-preference)');
      let frame: number | undefined;
      const update = () => {
        frame = undefined;
        if (!media.matches) {
          pills.style.removeProperty('--parallax');
          return;
        }
        const rect = pills.getBoundingClientRect();
        const progress = Math.max(-1, Math.min(1, (window.innerHeight - rect.top * 2 - rect.height) / (window.innerHeight + rect.height)));
        const travel = Math.min(32, Math.max(8, (window.innerWidth - 352) / 2));
        pills.style.setProperty('--parallax', `${progress * travel}px`);
      };
      const schedule = () => {
        if (frame === undefined) frame = requestAnimationFrame(update);
      };
      const onScroll = () => { if (media.matches) schedule(); };
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', schedule);
      media.addEventListener('change', schedule);
      schedule();
      this.cleanupParallax = () => {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', schedule);
        media.removeEventListener('change', schedule);
        if (frame !== undefined) cancelAnimationFrame(frame);
      };
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.cleanupParallax?.();
    if (this.selectedFeature()) this.onFeatureClosed();
  }

  protected openFeature(feature: FeatureCard): void {
    this.selectedFeature.set(feature);
    this.changeDetector.detectChanges();
    this.previousOverflow = this.document.documentElement.style.overflow;
    this.document.documentElement.style.overflow = 'hidden';
    this.featureDialog.nativeElement.showModal();
    this.featureDialog.nativeElement.scrollTop = 0;
  }

  protected closeFeature(): void {
    this.featureDialog.nativeElement.close();
  }

  protected onFeatureClosed(): void {
    this.document.documentElement.style.overflow = this.previousOverflow;
    this.selectedFeature.set(null);
  }

  protected closeFeatureOnBackdrop(event: MouseEvent): void {
    const dialog = this.featureDialog.nativeElement;
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
      this.closeFeature();
    }
  }

  protected avatarColor(index: number): string {
    return AVATAR_COLORS[index % AVATAR_COLORS.length];
  }

  protected initialOf(name: string): string {
    return name.trim().charAt(0).toUpperCase() || '?';
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  private maybeAnimate(): void {
    if (!this.dataReady || !this.sectionVisible || this.animated) return;
    this.animated = true;
    const target = this.targets();
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / COUNT_UP_MS);
      const eased = 1 - Math.pow(1 - p, 3);
      this.displayed.set({
        events: Math.round(target.events * eased),
        cities: Math.round(target.cities * eased),
        going: Math.round(target.going * eased),
        reviews: Math.round(target.reviews * eased),
      });
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}
