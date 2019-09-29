import React, { useState } from 'react';
import Ruler from "./Ruler";
import Blockies from 'react-blockies';
import { Scaler } from "dapparatus";

import i18n from '../i18n';

import InputRange from 'react-input-range';
import 'react-input-range/lib/css/index.css';
import core from '../core';

const { toWei, fromWei, toBN } = require('web3-utils');


const logoStyle = {
  maxWidth:50,
  maxHeight:50,
}

const colStyle = {
  textAlign:"center",
  whiteSpace:"nowrap"
}

const AmountBar = (props) => {
  return (
    <div className="col-6 p-1" style={colStyle}>
    <Scaler config={{startZoomAt:400,origin:"50% 50%"}}>
    <div className="input-group">
      <div className="input-group-prepend">
        <div className="input-group-text">$</div>
      </div>
      <input type="number" step="0.1" className="form-control" placeholder="0.00" value={props.value}
              onChange={event => props.updateValue(event.target.value)} />
        <div className="input-group-append" onClick={ event => {props.updateValue(fromWei(props.maxValue.toString(), "ether"))}}>
          <span className="input-group-text" id="basic-addon2" style={props.buttonStyle.secondary}>
            max
          </span>
        </div>
      </div>
      </Scaler>
    </div>
  )
}

const Swapper = (props) => {
  
  const [amount, setAmount] = useState("");

  let cancelButton = (
    <span style={{padding:10,whiteSpace:"nowrap"}}>
      <a href="#" style={{color:"#000000"}} onClick={() => props.cancelAction()}>
        <i className="fas fa-times"/> {i18n.t('cancel')}
      </a>
    </span>
  )

  return (
    <div className="content ops row">

      <div className="col-1 p-1"  style={colStyle}>
        <i className={`fas ${props.icon}`}  />
      </div>
      <AmountBar
        buttonStyle={props.buttonStyle}
        value={amount}
        updateValue={amount => setAmount(amount)}
        maxValue={props.maxValue}
      />
      <div className="col-2 p-1"  style={colStyle}>
        <Scaler config={{startZoomAt:650,origin:"0% 85%"}}>
        {cancelButton}
        </Scaler>
      </div>
      <div className="col-3 p-1">
        <button className="btn btn-large w-100" disabled={props.buttonsDisabled} style={props.buttonStyle.primary} onClick={async ()=>{
          props.successAction(amount)
        }}>
          <Scaler config={{startZoomAt:600,origin:"10% 50%"}}>
            <i className={`fas ${props.icon}`} /> Send
          </Scaler>
        </button>

      </div>
    </div>
  )
}


export default class SwapBar extends React.Component {

  constructor(props) {
    super(props);

    this.state = {
      swapMode: false,
      loaderBarStatusText: i18n.t('loading'),
      loaderBarStartTime:Date.now(),
      loaderBarPercent: 2,
      loaderBarColor: "#aaaaaa",
      gwei: 5,
      maxWithdrawlAmount: 0.00,
      withdrawalExplanation: i18n.t('exchange.withdrawal_explanation'),
    }
  }

  render() {
    let {swapMode} = this.state

    let buttonsDisabled = (
      swapMode=="depositing" || swapMode=="withdrawing"
    )

    let adjustedFontSize = Math.round((Math.min(document.documentElement.clientWidth,600)/600)*24)
    let adjustedTop = Math.round((Math.min(document.documentElement.clientWidth,600)/600)*-20)+9

    let display =  i18n.t('loading')

    if(swapMode=="depositing" || swapMode=="withdrawing"){
      display = (
        <div className="content ops row" style={{position:"relative"}}>
          <button style={{width:Math.min(100,this.state.loaderBarPercent)+"%",backgroundColor:this.state.loaderBarColor,color:"#000000"}}
            className="btn btn-large"
          >
          </button>
          <div style={{position:'absolute',left:"50%",width:"100%",marginLeft:"-50%",fontSize:adjustedFontSize,top:adjustedTop,opacity:0.95,textAlign:"center"}}>
            {this.state.loaderBarStatusText}
          </div>
        </div>
      )

    }else if(swapMode=="deposit"){
      display = (
        <Swapper 
          icon={"fa-arrow-up"}
          buttonStyle={this.props.buttonStyle}
          maxValue={this.props.onchainBalance}
          buttonsDisabled={buttonsDisabled}
          successAction={(amount) => {
            this.props.deposit(toWei(amount, "ether"))
            this.setState({swapMode:false})
          }}
          cancelAction={() => {
            this.setState({swapMode:false})
          }}
        />
      )
    }else if(swapMode=="withdraw"){
      if(this.props.ethBalance<=0){
        display = (
          <div className="content ops row" style={{textAlign:'center'}}>
            <div className="col-12 p-1">
              Error: You must have ETH to withdraw {this.props.text}.
              <a href="#" onClick={()=>{this.setState({swapMode:false})}} style={{marginLeft:40,color:"#666666"}}>
                <i className="fas fa-times"/> dismiss
              </a>
            </div>
          </div>
        )
      }else{
        display = (
          <Swapper 
            icon={"fa-arrow-down"}
            buttonStyle={this.props.buttonStyle}
            maxValue={this.props.withdrawLimit}
            buttonsDisabled={buttonsDisabled}
            successAction={(amount) => {
              this.props.requestWithdraw(toWei(amount, "ether"))
              this.setState({swapMode:false})
            }}
            cancelAction={() => {
              this.setState({swapMode:false})
            }}
          />
        )
      }

    }else{
      display = (
         <div className="content ops row">

           <div className="col-6 p-1">
             <button className="btn btn-large w-100"  style={this.props.buttonStyle.primary} disabled={buttonsDisabled}  onClick={()=>{
               this.setState({swapMode:"deposit"})
             }}>
               <Scaler config={{startZoomAt:400,origin:"50% 50%"}}>
                <i className="fas fa-arrow-up"  /> {this.props.text} to f{this.props.text}
               </Scaler>
             </button>
           </div>

           <div className="col-6 p-1">
             <button className="btn btn-large w-100"  style={this.props.buttonStyle.primary} disabled={buttonsDisabled}  onClick={()=>{
               this.setState({swapMode:"withdraw"})
             }}>
              <Scaler config={{startZoomAt:400,origin:"50% 50%"}}>
               <i className="fas fa-arrow-down" /> f{this.props.text} to {this.props.text}
              </Scaler>
             </button>
           </div>
         </div>
       )

    }

    return (
      <div className="main-card card w-100">
        {display}
      </div>
    )
  }
}
