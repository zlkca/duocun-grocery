import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { ProductService } from '../../product/product.service';
import { ActivatedRoute, Router } from '../../../../node_modules/@angular/router';
import { takeUntil } from '../../../../node_modules/rxjs/operators';
import { Subject } from '../../../../node_modules/rxjs';
import { NgRedux } from '../../../../node_modules/@angular-redux/store';
import { IAppState } from '../../store';
import * as moment from 'moment';
import { CartActions } from '../cart.actions';
import { CartService } from '../cart.service';
import { MerchantScheduleService } from '../../merchant/merchant-schedule.service';
import { AreaService } from '../../area/area.service';

const baseTimeList = ['11:00'];
const ADVANCE_OFFSET = 2; // 2 days

@Component({
  selector: 'app-delivery-page',
  templateUrl: './delivery-page.component.html',
  styleUrls: ['./delivery-page.component.scss']
})
export class DeliveryPageComponent implements OnInit {
  deliveries = [];
  onDestroy$ = new Subject();
  cart;
  product;
  button;
  amount;
  location;
  inRange = true;

  constructor(
    private productSvc: ProductService,
    private merchantScheduleSvc: MerchantScheduleService,
    private cartSvc: CartService,
    private areaSvc: AreaService,
    private router: Router,
    private route: ActivatedRoute,
    private rx: NgRedux<IAppState>
  ) {
    this.rx.select('cart').pipe(takeUntil(this.onDestroy$)).subscribe((cart: any) => {
      this.cart = cart;
    });
    this.rx.select('delivery').pipe(takeUntil(this.onDestroy$)).subscribe((d: any) => {
      this.location = d.origin;
    });
  }

  ngOnInit() {
    this.route.params.pipe(takeUntil(this.onDestroy$)).subscribe(params => {
      const productId = params['id'];
      this.monunt(productId, this.cart);
      this.amount = this.cartSvc.getTotalPrice(this.cart);
    });
  }




  // baseList --- moment object
  // baseTimeList eg. ['11:20']
  // return [{ date, time, quantity }];
  getDeliverySchedule(baseList) {
    // const baseList = baseDateList.map(baseDate => baseDate + 'T' + baseTimeList[0] + ':00.000Z');
    const list = [];
    if (baseList && baseList.length > 0) {
      for (let i = 0; i < 30; i++) {
        const dateList = baseList.map(m => m.add(7 * i, 'days').toISOString().split('T')[0]);
        dateList.map(d => {
          baseTimeList.map(t => {
            // const taxRate = product.taxRate !== null ? product.taxRate : 0;
            list.push({ date: d, time: t, quantity: 0 }); // , quantity:0, price: product.price, cost: product.cost, taxRate });
          });
        });
      }
      return list;
    } else {
      return list;
    }
  }

  // slots [{date, time}...]
  // cart --- { product, deliveries:[{date, time, quantity}]}
  mergeQuantity(slots, cart, productId) {
    const ds = [];
    const cartItem = cart.find(it => it.product && it.product._id === productId);

    if (cartItem && cartItem.deliveries && cartItem.deliveries.length > 0) { // try merge
      slots.map(slot => {
        const updated = cartItem.deliveries.find(d => slot.date + slot.time === d.date + d.time);
        if (updated) {
          ds.push({ ...slot, quantity: updated.quantity });
        } else {
          ds.push(slot);
        }
      });
      return ds;
    } else {
      return slots;
    }
  }

  // n -- dow
  getBaseDate(n) {
    const lastDow = moment().day(n - 7);
    const dow = moment().day(n);
    const nextDow = moment().day(n + 7);
    const d = moment().add(ADVANCE_OFFSET, 'days');
    if (d.isAfter(lastDow) && d.isSameOrBefore(dow)) {
      return dow;
    } else if (d.isAfter(dow) && d.isSameOrBefore(nextDow)) {
      return nextDow;
    } else {
      return nextDow;
    }
  }

  monunt(productId, cart) {
    return new Promise((_resolve, reject) => {
      this.productSvc.getById(productId, ['_id', 'name', 'price', 'cost', 'taxRate', 'merchantId']).then((product: any) => {
        const merchantId = product.merchantId;
        const location = this.location;
        this.product = product;
        this.merchantScheduleSvc.getAvailableSchedules(merchantId, location).then((rs: any[]) => {
          if (rs && rs.length > 0) {

            const dows = rs && rs.length > 0 ? rs.map(r => +r.deliver.dow) : [];
            const bs = dows.length > 0 ? dows.map(dow => this.getBaseDate(+dow)) : [];
            this.inRange = true;
            const ds = this.getDeliverySchedule(bs);
            this.deliveries = this.mergeQuantity(ds, cart, productId);
            this.amount = this.cartSvc.getTotalPrice(cart);
          } else {
            this.inRange = false;
          }
        });
      });
    });
  }

  onDeliveryItemChange(e) {
    const product = this.product;
    const delivery = e;

    this.rx.dispatch({ type: CartActions.UPDATE_QUANTITY, payload: { product, delivery } });
  }

  onNext() {
    this.router.navigate(['merchant/list/' + this.product.merchantId]);
  }
}