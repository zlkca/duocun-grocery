import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, Router, ActivatedRouteSnapshot } from '../../../../node_modules/@angular/router';
import { Subject, Observable } from '../../../../node_modules/rxjs';
import { takeUntil } from '../../../../node_modules/rxjs/operators';
import { MerchantService } from '../merchant.service';
import { IMerchant } from '../../merchant/merchant.model';
import { ProductService } from '../../product/product.service';
import { NgRedux } from '../../../../node_modules/@angular-redux/store';
import { ICart, ICartItem } from '../../cart/cart.model';
import { PageActions } from '../../main/main.actions';
import { MatDialog } from '../../../../node_modules/@angular/material';
import { QuitMerchantDialogComponent } from '../quit-merchant-dialog/quit-merchant-dialog.component';
import { IDelivery } from '../../delivery/delivery.model';
import { environment } from '../../../environments/environment';
import { CartActions } from '../../cart/cart.actions';
import { CartService } from '../../cart/cart.service';
import { OrderFormAction } from '../../order/order-form-page/order-form-page.component';


@Component({
  selector: 'app-merchant-detail-page',
  templateUrl: './merchant-detail-page.component.html',
  styleUrls: ['./merchant-detail-page.component.scss']
})
export class MerchantDetailPageComponent implements OnInit, OnDestroy {
  categories: any[];

  onDestroy$ = new Subject<any>();
  locationSubscription;
  dow: number; // day of week
  cart;
  delivery: IDelivery;
  lang = environment.language;
  onSchedule: boolean;
  bHasAddress: boolean;
  dialogRef;
  action = '';
  currentUrl;

  products;
  merchant: IMerchant;
  subscription;
  amount = 0;
  items;
  @ViewChild('list', { static: true }) list: ElementRef;

  constructor(
    private productSvc: ProductService,
    private merchantSvc: MerchantService,
    private cartSvc: CartService,
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private rx: NgRedux<ICart>,
    public dialog: MatDialog
  ) {
    const self = this;

    // show cart on footer
    this.rx.dispatch({ type: PageActions.UPDATE_URL, payload: { name: 'restaurant-detail' } });

    this.rx.select('delivery').pipe(takeUntil(this.onDestroy$)).subscribe((x: IDelivery) => {
      self.delivery = x;
      self.bHasAddress = x.origin ? true : false;
    });

    this.rx.select('cart').pipe(takeUntil(this.onDestroy$)).subscribe(cart => {
      this.cart = cart;
      // // update quantity of cart items
      // if (self.groups && self.groups.length > 0) {
      //   self.groups = this.mergeQuantityFromCart(self.groups, cart);
      // }
      if (cart) {
        // const ds = this.getDeliverySchedule();
        // this.deliveries = this.mergeQuantity(ds, cart, this.product._id);
        this.amount = this.cartSvc.getTotalPrice(cart);
      }
    });

    this.locationSubscription = this.location.subscribe((x) => {
      const merchantId = self.merchant._id;

      if (window.location.pathname.endsWith('main/home') || window.location.pathname.endsWith('/') ||
        window.location.pathname.endsWith('contact/address-form')
      ) {
        if (self.cart && self.cart.length > 0) {
          self.openQuitMerchantDialog(merchantId, 'restaurant-list');
        }
      } else if (window.location.pathname.endsWith('order/history')) {
        // if (self.restaurant && self.cart && self.cart.items && self.cart.items.length > 0) {
        //   this.openDialog(merchantId, 'order-history');
        // }
      }
    });

  }

  ngOnInit() {
    const self = this;
    // const balance = Math.round(this.state.account.balance * 100) / 100;
    // const payable = Math.round((balance >= this.summary.total ? 0 : this.summary.total - balance) * 100) / 100;
    // const charge = { ...this.summary, ...{ payable }, ...{ balance } };
    // const merchant = this.state.merchant;


    this.route.params.pipe(takeUntil(this.onDestroy$)).subscribe(params => {
      const merchantId = params['id'];

      this.componentDidMount(merchantId).then((r: any) => {
        this.products = r.products;
        this.merchant = r.merchant;
        const items = r.products.map(p => {
          return { product: p, quantity: 0 };
        });
        this.items = this.mergeCart(this.cart, items);
      });
    });
  }

  // mergeQuantityFromCart(groups, cart) {
  //   groups.map(group => {
  //     group.items.map(groupItem => {
  //       const cartItem: ICartItem = cart.items.find(item => item.productId === groupItem.product._id);
  //       groupItem.quantity = cartItem ? cartItem.quantity : 0;
  //     });
  //   });
  //   return groups;
  // }

  ngOnDestroy() {
    this.locationSubscription.unsubscribe();
    this.onDestroy$.next();
    this.onDestroy$.complete();
  }

  openQuitMerchantDialog(merchantId: string, fromPage: string, targetUrl?: string): void {
    const self = this;
    this.dialogRef = this.dialog.open(QuitMerchantDialogComponent, {
      width: '300px',
      data: { merchantId, fromPage },
      closeOnNavigation: true
    });

    this.dialogRef.afterClosed().pipe(takeUntil(this.onDestroy$)).subscribe((r: any) => {
      this.action = r.action;
      if (r.action === 'leave') {
        // pass
      } else if (r.action === 'stay') {
        // pass
      }
    });
  }

  onAfterCheckout(e) {

  }

  onNext() {
    this.router.navigate(['order/form/' + OrderFormAction.NEW]); //  { queryParams: { fromPage: 'restaurant-detail' } });
  }


  componentDidMount(merchantId) {
    // tslint:disable-next-line:no-shadowed-variable
    return new Promise((resolve, reject) => {
      this.merchantSvc.getById(merchantId).then(merchant => {
        this.productSvc.quickFind({ merchantId, status: 1 }, ['_id', 'name', 'description', 'price', 'pictures', 'order']).
          then((products: any[]) => {
            const ps = products.sort((a: any, b: any) => {
              return a.order > b.order ? 1 : -1;
            });

            resolve({ merchant, products });
          });
      });
    });
  }

  // merge quantity in card into product
  mergeCart(cart, currItems) {
    if (cart && cart.length > 0) {
      cart.map((it: any) => {
        let quantity = 0;
        it.deliveries.map(d => quantity += (d.quantity ? d.quantity : 0));

        currItems.map(ci => {
          if (it.product._id === ci.product._id) {
            ci.quantity = quantity;
          }
        });
      });
      return currItems;
    } else {
      return currItems.map(ci => {
        return { product: ci.product, quantity: 0 };
      });
    }
  }


  onSelectShoppingItem(item) {
    const addressHint = this.lang === 'en' ? 'Please enter delivery address' : '请先输入送货地址';
    if (!this.bHasAddress) {
      alert(addressHint);
      this.router.navigate(['main/home']);
      return;
    } else {
      // this.selected = p;
      this.router.navigate(['cart/delivery/' + item.product._id]);
    }
  }
}
