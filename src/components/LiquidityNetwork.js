import React from 'react';
import {
  BrowserRouter as Router,
  Switch,
  Route,
  Link,
  Redirect
} from "react-router-dom";
import cookie from 'react-cookies'

import { Events, Blockie, Scaler } from "dapparatus";
import Web3 from 'web3';
import Ruler from "./Ruler";
import axios from "axios"
import i18n from '../i18n';
import i18next from 'i18next';

import NavCard from './NavCard';
import Bottom from './Bottom';
import Loader from './Loader';

import LiquiditySendByScan from './LiquiditySendByScan'
import LiquidityReceive from './LiquidityReceive'
import LiquiditySendToAddress from './LiquiditySendToAddress'
import LiquidityTransactions from './LiquidityTransactions'
import LiquidityBridge from './LiquidityBridge';
import LiquidityExchange from './LiquidityExchange'

import Balance from "./Balance";

import { NOCUSTManager } from 'nocust-client'

import ethImg from '../images/ethereum.png';
import daiImg from '../images/dai.jpg';
import lqdImg from '../liquidity.png';
import burnerlogo from '../liquidity.png';
let LOADERIMAGE = burnerlogo


const { toWei, fromWei, toBN } = require('web3-utils');
const qs = require('query-string');


const HUB_CONTRACT_ADDRESS = process.env.REACT_APP_HUB_CONTRACT_ADDRESS
const HUB_API_URL = process.env.REACT_APP_HUB_API_URL
const RPC_URL = process.env.REACT_APP_RPC_URL
const TEST_DAI_ADDRESS = process.env.REACT_APP_TEST_DAI_ADDRESS

function getDisplayValue(value, decimals=4) {
  const displayVal = fromWei(value.toString(), 'ether');
  if (displayVal.indexOf('.') >= 0){
    return displayVal.substr(0, displayVal.indexOf('.') + decimals + 1);
  }
  return displayVal
}

export default class LiquidityNetwork extends React.Component {

  constructor(props) {
    super(props);

    let limboweb3 = new Web3(new Web3.providers.HttpProvider(RPC_URL))
    limboweb3.eth.accounts.wallet.add(props.privateKey)

    const nocustManager = new NOCUSTManager({
      rpcApi: limboweb3,
      operatorApiUrl: HUB_API_URL,
      contractAddress: HUB_CONTRACT_ADDRESS,
      });

    console.log(nocustManager)

    var tokens = cookie.load('availableTokens') 
    if (typeof tokens === 'undefined') {
      tokens = { "ETH": {}, "DAI": {}, "LQD": {} }
    }

    var balances = cookie.load('tokenBalances') 
    if (typeof balances === 'undefined') {
      balances = { "ETH": {}, "DAI": {}, "LQD": {} }
    }

    
    this.state = {
      nocustManager: nocustManager,
      address: limboweb3.eth.accounts.wallet[0].address,
      addressRegistered: false,
      blocksToWithdrawal: -1,
      tokens: tokens,
      balances: balances
    }

    this.getAssets()

    this.checkRegistration().then((addressRegistered) => {
      if (!addressRegistered) {
        this.registerWithHub()
      }
    })
  }

  componentDidMount(){

    this.state.nocustManager.subscribeToIncomingTransfer(
      this.state.address,
      tx => {
        console.log(`Incoming transaction from: ${tx.wallet.address} of: ${tx.amount.toString()} wei of token ${tx.wallet.token}.`)
        this.checkTokenBalances()
        this.getTransactions()
      }, 
      'all'
    ).then((unsubscribe) => this.setState({unsubscribe}))
    this.checkTokenBalances()
    this.getTransactions()


    setTimeout(this.longPollInterval.bind(this),30)
    const longPollingIntervalId = setInterval(this.longPollInterval.bind(this),8000)
    this.setState({longPollingIntervalId})
  }
  
  componentWillUnmount(){
    if (typeof this.state.unsubscribe === 'function') {
      console.log("Unsubscribing from incoming transactions")
      this.state.unsubscribe()
    }

    console.log("No longer polling NOCUST")
    clearInterval(this.state.longPollingIntervalId)
  }

  async checkRegistration(){
    const addressRegistered = await this.state.nocustManager.isAddressRegistered(this.state.address)
    console.log(addressRegistered ? "Already registered" : "Address hasn't registered with the hub")
    this.setState({addressRegistered})
    return addressRegistered 
  }

  async getAssets(){
    console.log("Retrieving which tokens are supported by hub")
    const tokenList = await this.state.nocustManager.getSupportedTokens()
    
    var tokens = tokenList.reduce((accumulator, pilot) => {
      return {...accumulator, [pilot.shortName]: {name: pilot.name, shortName: pilot.shortName, tokenAddress: pilot.tokenAddress}}
    }, {})

    tokens.ETH.image = ethImg
    // tokens.DAI.image = daiImg
    tokens.LQD.image = lqdImg
    this.setState({tokens: tokens})
    cookie.save('availableTokens', tokens, { path: '/', maxAge: 60 })
  }

  async registerWithHub(){
    console.log("Registering with hub")
    if (this.state.tokens) {
      for (let [key, value] of Object.entries(this.state.tokens)) {
        this.state.nocustManager.registerAddress(this.state.address, value.tokenAddress)
      }
    }
  }

  async longPollInterval(){
    console.log("LONGPOLL")
    this.checkTokenBalances()
    this.checkWithdrawalInfo()
  }
  
  async checkTokenBalances(){
    if (this.state.tokens) {
      for (let [key, value] of Object.entries(this.state.tokens)) {
        this.checkTokenBalance(key, value.tokenAddress)
      }
    }
    console.log(this.state.balances)
    cookie.save('tokenBalances', this.state.balances, { path: '/', maxAge: 60 })

  }

  async checkTokenBalance (name, tokenAddress) {
    const onchainBalance = await this.state.nocustManager.getOnChainBalance(this.state.address, tokenAddress)
    const offchainBalance = await this.state.nocustManager.getNOCUSTBalance(this.state.address, tokenAddress)

    const displayOnchain = getDisplayValue(toBN(onchainBalance))
    const displayOffchain = getDisplayValue(toBN(offchainBalance))

    this.setState({balances: {...this.state.balances, [name]: {onchainBalance, offchainBalance, displayOnchain, displayOffchain}}})
  }

  async getTransactions() {
    let transactions = await this.state.nocustManager.getTransactionsForAddress(this.state.address, TEST_DAI_ADDRESS)
    if (transactions.length) {
      transactions = transactions.reverse()
    }
    this.setState({transactions})
  }

  async checkWithdrawalInfo () {
    const withdrawFee = await this.state.nocustManager.getWithdrawalFee(toWei(this.props.gwei.toString(), "gwei"))
    const ethWithdrawLimit = await this.state.nocustManager.getWithdrawalLimit(this.state.address, HUB_CONTRACT_ADDRESS)
    const daiWithdrawLimit = await this.state.nocustManager.getWithdrawalLimit(this.state.address, TEST_DAI_ADDRESS)
    const blocksToWithdrawal = await this.state.nocustManager.getBlocksToWithdrawalConfirmation(this.state.address, undefined, HUB_CONTRACT_ADDRESS)

    this.setState({withdrawFee, ethWithdrawLimit, daiWithdrawLimit, blocksToWithdrawal})
  }

  async confirmWithdrawal () {
    const gasLimit = "300000"

    const txhash = await this.state.nocustManager.withdrawalConfirmation(this.state.address, toWei(this.props.gwei.toString(), "gwei"), gasLimit, HUB_CONTRACT_ADDRESS)
    console.log("withdrawal", txhash)
    this.checkTokenBalances()
  }

  render(){

    let sendButtons = (
      <div>
        {typeof this.state.blocksToWithdrawal !== 'undefined' && this.state.blocksToWithdrawal != -1 &&
        <div className="content ops row">
          <div className="col-12 p-1" onClick={() => this.confirmWithdrawal()}>
            <button className={`btn btn-large w-100 ${this.state.blocksToWithdrawal == 0 ? '' : 'disabled'}`} style={this.props.buttonStyle.primary}>
              <Scaler config={{startZoomAt:400,origin:"50% 50%"}}>
                <i className={`fas ${this.state.blocksToWithdrawal == 0 ? 'fa-check' : 'fa-clock'}`}/> {this.state.blocksToWithdrawal == 0 ? i18next.t('liquidity.withdraw.confirm') : this.state.blocksToWithdrawal + " blocks until confirmation"}
              </Scaler>
            </button>
          </div>
        </div>}
        <div className="content ops row">
          <div className="col-6 p-1" >
            <button className="btn btn-large w-100" style={this.props.buttonStyle.primary}>
              <Link to="/liquidity/receive" style={{ textDecoration: 'none', color: this.props.buttonStyle.primary.color }}>
                <Scaler config={{startZoomAt:400,origin:"50% 50%"}}>
                  <i className="fas fa-qrcode"  /> {i18next.t('main_card.receive')}
                </Scaler>
              </Link>
            </button>
          </div>
          <div className="col-6 p-1">
            <button className="btn btn-large w-100" style={this.props.buttonStyle.primary}>
              <Link to={{pathname:"/liquidity/send", search: "?token=LQD"}} style={{ textDecoration: 'none', color: this.props.buttonStyle.primary.color }}>
                <Scaler config={{startZoomAt:400,origin:"50% 50%"}}>
                  <i className="fas fa-paper-plane"/> {i18next.t('main_card.send')}
                </Scaler>
              </Link>
            </button>
          </div>
        </div>
        <div className="content ops row">
          <div className="col-6 p-1" >
            <button className="btn btn-large w-100" style={this.props.buttonStyle.secondary}>
              <Link to="/liquidity/bridge" style={{ textDecoration: 'none', color: this.props.buttonStyle.secondary.color }}>
                <Scaler config={{startZoomAt:400,origin:"50% 50%"}}>
                  <i className="fas fa-hand-holding-usd"/> {i18next.t('liquidity.bridge.title')}
                </Scaler>
              </Link>
            </button>
          </div>
          <div className="col-6 p-1" >
            <button className="btn btn-large w-100" style={this.props.buttonStyle.secondary}>
              <Link to="/liquidity/exchange" style={{ textDecoration: 'none', color: this.props.buttonStyle.secondary.color }}>
                <Scaler config={{startZoomAt:400,origin:"50% 50%"}}>
                  <i className="fas fa-random"/> {i18next.t('exchange_title')}
                </Scaler>
              </Link>
            </button>
          </div>
        </div>
      </div>
    )
    return (
      <Switch>
        <Route path="/liquidity/receive">
          <div>
              <div className="main-card card w-100" style={{zIndex:1}}>

                <NavCard title={i18n.t('receive_title')}/>
                <LiquidityReceive
                  hubContract={HUB_CONTRACT_ADDRESS}
                  hubApiUrl={HUB_API_URL}
                  ensLookup={this.props.ensLookup}
                  buttonStyle={this.props.buttonStyle}
                  address={this.state.address}
                  changeAlert={this.props.changeAlert}
                />
              </div>
              <Link to="/liquidity">
                <Bottom
                  action={()=>{}}
                />
              </Link>
            </div>
        </Route>

        <Route
          path="/liquidity/sending"
          render={({history}) => (
            <div>
              <div style={{zIndex:1,position:"relative",color:"#dddddd"}}>
                <NavCard title={"Sending..."} darkMode/>
              </div>
              <Loader
                loaderImage={LOADERIMAGE}
                mainStyle={this.props.mainStyle}
                onFinish={() => { history.replace("/") }}/>
            </div>
          )}
        />

        <Route
          path="/liquidity/send/:toAddress"
          render={({ location, match }) => (
            <Redirect to={{ pathname: "/liquidity/send", search: location.search, state: { toAddress: match.params.toAddress } }} />
            )}
        />

        <Route
          path="/liquidity/send"
          render={({ history, location }) => {
            const token = this.state.tokens[qs.parse(location.search).token] 
            const tokenBalance = this.state.balances[qs.parse(location.search).token]
            console.log("token", token)
            return (
            <div>
              <div className="send-to-address card w-100" style={{zIndex:1}}>
              
                <NavCard title={i18n.t('send_to_address_title')} />
                <Balance
                  token={token}
                  balance={tokenBalance}
                  offchain
                  selected
                  address={this.props.account}
                  dollarDisplay={(balance)=>{return balance}}
                />
                <Ruler/>
                <LiquiditySendToAddress
                  nocustManager={this.state.nocustManager}
                  convertToDollar={(dollar) => {return dollar}}
                  dollarSymbol={"$"}
                  text={"f"+token.shortName}
                  toAddress={typeof location.state !== 'undefined' ? location.state.toAddress : undefined}
                  ensLookup={this.props.ensLookup}
                  buttonStyle={this.props.buttonStyle}
                  offchainBalance={tokenBalance.displayOffchain}
                  tokenAddress={token.tokenAddress}
                  address={this.state.address}
                  changeAlert={this.props.changeAlert}
                  dollarDisplay={(balance)=>{return balance}}
                  onSend={() => {
                    history.push("/liquidity/sending")
                    setTimeout(() => {
                      this.checkTokenBalances()
                      this.getTransactions()
                    }, 2000)
                  }}
                />
              </div>
              <Link to="/liquidity">
                <Bottom
                  action={()=>{}}
                />
              </Link>
            </div>
          )}}
        />


        <Route path="/liquidity/bridge">
          <div>
            <div className="main-card card w-100" style={{zIndex:1}}>
              <NavCard title={i18n.t('liquidity.bridge.title')} />
              Withdrawal Fee: {typeof this.state.withdrawFee !== 'undefined' ? fromWei(this.state.withdrawFee.toString(), 'ether').toString() : 0} ETH
              <Ruler/>
              <LiquidityBridge
                address={this.state.address}
                token={this.state.tokens.ETH}
                balance={this.state.balances.ETH}
                buttonStyle={this.props.buttonStyle}
                nocust={this.state.nocustManager}
                ethBalance={this.state.balances.ETH.onchainBalance}
                gasPrice={toWei(this.props.gwei.toString(), "gwei")}
                withdrawLimit={this.state.ethWithdrawLimit}
              />
              <Ruler/>
              <LiquidityBridge
                address={this.state.address}
                token={this.state.tokens.LQD}
                balance={this.state.balances.LQD}
                buttonStyle={this.props.buttonStyle}
                nocust={this.state.nocustManager}
                ethBalance={this.state.balances.ETH.onchainBalance}
                gasPrice={toWei(this.props.gwei.toString(), "gwei")}
                withdrawLimit={this.state.daiWithdrawLimit}
              />
            </div>
            <Link to="/liquidity">
              <Bottom
                action={()=>{}}
              />
            </Link>
          </div>
        </Route>

        <Route path="/liquidity/exchange">
          <div>
            <div className="main-card card w-100" style={{zIndex:1}}>
              <NavCard title={i18n.t('exchange_title')} />
              <LiquidityExchange
                assetA={this.state.tokens.ETH}
                assetB={this.state.tokens.LQD}
                assetABalance={this.state.balances.ETH}
                assetBBalance={this.state.balances.LQD}
                address={this.state.address}
                buttonStyle={this.props.buttonStyle}
                nocust={this.state.nocustManager}
              />
            </div>
            <Link to="/liquidity">
              <Bottom
                action={()=>{}}
              />
            </Link>
          </div>
        </Route>

        <Route path="/liquidity">
        <div>
            <div className="send-to-address card w-100" style={{zIndex:1}}>
              <div className="form-group w-100">

                <div style={{width:"100%",textAlign:"center"}}>
                  <Link to={{pathname:"/liquidity/send", search: "?token=LQD"}} >
                    <Balance
                      token={this.state.tokens.LQD}
                      balance={this.state.balances.LQD}
                      offchain
                      selected
                      address={this.props.account}
                      dollarDisplay={(balance)=>{return balance}}
                  />
                  </Link>
                  <Ruler/>
                  <Balance
                    token={this.state.tokens.LQD}
                    balance={this.state.balances.LQD}
                    address={this.props.account}
                    dollarDisplay={(balance)=>{return balance}}
                  />
                  <Ruler/>
                  <Link to={{pathname:"/liquidity/send", search: "?token=ETH"}}>
                    <Balance
                      token={this.state.tokens.ETH}
                      balance={this.state.balances.ETH}
                      offchain
                      selected
                      address={this.props.account}
                      dollarDisplay={(balance)=>{return balance}}
                        />
                  </Link>
                  <Ruler/>
                  <Balance
                    token={this.state.tokens.ETH}
                    balance={this.state.balances.ETH}
                    address={this.props.account}
                    dollarDisplay={(balance)=>{return balance}}
                  />
                  <Ruler/>

                  {sendButtons}

                  </div>
                  <LiquidityTransactions
                    dollarDisplay={(balance)=>{return balance}}
                    changeAlert={this.props.changeAlert}
                    address={this.state.account}
                    recentTxs={this.state.transactions}
                  />
              </div>
          </div>
            <Link to="/advanced">
              <Bottom
                icon={"wrench"}
                text={i18n.t('advance_title')}
                action={()=>{}}
              />
            </Link>
          </div>
        </Route>
      </Switch>
    )
  }
}
